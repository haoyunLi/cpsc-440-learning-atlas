import * as M from './math.mjs';
import { parseSample } from './sample.mjs';
import { diagnosticData as buildDiagnosticData, mountDiagnostics } from './diagnostics.mjs';
export { parseSample } from './sample.mjs';

const clamp = x => Math.max(0, Math.min(1, x));
const format = (x, n = 4) => Number.isFinite(x) ? (Math.abs(x) > 0 && Math.abs(x) < .0001 ? x.toExponential(3) : x.toFixed(n)) : '无法计算';

// Compute small upper tails directly instead of subtracting a rounded CDF from 1.
function normalUpper(x) {
  if (x < 0) return 1 - normalUpper(-x);
  if (x >= 5) {
    let fraction = 0;
    for (let i = 120; i >= 1; i--) fraction = i / (x + fraction);
    return M.normalPDF(x) / (x + fraction);
  }
  return M.normalCDF(-x);
}
function gammaUpper(x, a) {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - M.gammaCDF(x, a);
  const factor = Math.exp(a * Math.log(x) - x - M.logGamma(a));
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return clamp(factor * h);
}

export function distribution(kind, df1 = 10, df2 = 20) {
  if (!['normal', 't', 'chi', 'f'].includes(kind)) throw Error('未知分布');
  if (!(df1 >= 1 && df1 <= 100 && df2 >= 1 && df2 <= 100)) throw Error('自由度需在 1–100 之间；可以使用非整数 df。');
  const cdf = kind === 'normal' ? x => x < 0 ? normalUpper(-x) : 1 - normalUpper(x) : kind === 't' ? x => M.studentCDF(x, df1) : kind === 'chi' ? x => M.chiCDF(x, df1) : x => M.fCDF(x, df1, df2);
  const survival = kind === 'normal' ? normalUpper : kind === 't' ? x => x >= 0 ? .5 * M.betaCDF(df1 / (df1 + x * x), df1 / 2, .5) : 1 - .5 * M.betaCDF(df1 / (df1 + x * x), df1 / 2, .5) : kind === 'chi' ? x => gammaUpper(x / 2, df1 / 2) : x => x <= 0 ? 1 : M.betaCDF(df2 / (df2 + df1 * x), df2 / 2, df1 / 2);
  const atZero = kind === 'chi' ? (df1 < 2 ? Infinity : df1 === 2 ? .5 : 0) : (df1 < 2 ? Infinity : df1 === 2 ? 1 : 0);
  const pdf = kind === 'normal' ? M.normalPDF : kind === 't' ? x => Math.exp(M.logGamma((df1 + 1) / 2) - M.logGamma(df1 / 2)) / Math.sqrt(df1 * Math.PI) * (1 + x * x / df1) ** (-(df1 + 1) / 2) : kind === 'chi' ? x => x === 0 ? atZero : M.chiPDF(x, df1) : x => x > 0 ? Math.exp((df1 / 2) * Math.log(df1 / df2) + (df1 / 2 - 1) * Math.log(x) - ((df1 + df2) / 2) * Math.log1p(df1 * x / df2) - M.logGamma(df1 / 2) - M.logGamma(df2 / 2) + M.logGamma((df1 + df2) / 2)) : x === 0 ? atZero : 0;
  function quantile(p) {
    if (!(p > 0 && p < 1)) throw Error('概率必须在 0 与 1 之间。');
    if (kind === 'normal') return M.normalQuantile(p);
    if (kind === 't') return M.studentQuantile(p, df1);
    let hi = Math.max(20, df1 * 2);
    while (cdf(hi) < p && hi < 1e12) hi *= 2;
    return M.invert(cdf, p, 0, hi);
  }
  return { cdf, survival, pdf, quantile, positive: kind === 'chi' || kind === 'f' };
}

export function tailProbability(kind, observed, tail, df1 = 10, df2 = 20, alpha = .05) {
  if (!Number.isFinite(observed) || Math.abs(observed) > 1e4) throw Error('统计量必须是 −10000 至 10000 之间的有限数字。');
  if (!['left', 'right', 'two'].includes(tail) || !(alpha > 0 && alpha < 1)) throw Error('检验设置无效。');
  const d = distribution(kind, df1, df2);
  if (d.positive && observed < 0) throw Error('χ² 与 F 统计量不能为负数。');
  const c = clamp(d.cdf(observed));
  const s = clamp(d.survival(observed));
  const p = clamp(tail === 'left' ? c : tail === 'right' ? s : 2 * Math.min(c, s));
  const critical = tail === 'left' ? [d.quantile(alpha)] : tail === 'right' ? [d.quantile(1 - alpha)] : [d.quantile(alpha / 2), d.quantile(1 - alpha / 2)];
  const shade = tail === 'left' ? [-Infinity, observed] : tail === 'right' ? [observed, Infinity] : p === 0 ? [d.positive ? 0 : -Infinity, Infinity] : p === 1 ? [d.quantile(.5), d.quantile(.5)] : [d.quantile(p / 2), 1 - p / 2 === 1 ? Infinity : d.quantile(1 - p / 2)];
  return { p, critical, shade, reject: p <= alpha };
}

export function distributionPlot(kind, df1 = 10, df2 = 20) {
  const d = distribution(kind, df1, df2);
  // Low-df t/F tails can extend far beyond the informative center. Truncate the
  // display only; report the omitted mass and keep inference on the full model.
  const hi = kind === 't' ? Math.min(d.quantile(.999), 12) : kind === 'f' ? Math.min(d.quantile(.999), Math.max(20, 12 * d.quantile(.5))) : d.quantile(.999);
  const lo = d.positive ? 0 : -hi;
  const singular = d.positive && df1 < 2;
  const samples = Array.from({ length: 601 }, (_, i) => lo + (hi - lo) * i / 600);
  // The density genuinely tends to infinity at 0 for chi-square/F numerator
  // df<2. A labeled cap shows its shape without flattening all other values.
  const densityCap = singular ? d.pdf(d.quantile(.2)) : Math.max(...samples.map(d.pdf));
  const density = x => Math.min(densityCap, d.pdf(x));
  return { lo, hi, samples, density, densityCap, yMax: densityCap * 1.14, singular, omittedMass: d.cdf(lo) + d.survival(hi) };
}

export function distributionTick(value, step) {
  const decimals = Math.max(0, 1 - Math.floor(Math.log10(Math.abs(step))));
  return String(Number(value.toFixed(decimals)));
}

export function distributionProbabilityDisplay(kind, observed, tail, probability) {
  const positive = kind === 'chi' || kind === 'f';
  const exactZero = positive && observed === 0 && tail !== 'right';
  const exactOne = positive && observed === 0 && tail === 'right' || !positive && observed === 0 && tail === 'two';
  if (exactZero) return { text: 'P = 0', note: '此处是支持集边界：连续 χ² / F 分布在 0 及其左侧的概率为 0。' };
  if (exactOne) return { text: 'P = 1', note: positive ? '此处右尾覆盖该分布的全部支持集，概率为 1。' : '观测值在对称分布中心，双侧规则计入全部结果，概率为 1。' };
  if (probability === 0) return { text: 'P > 0（数值下溢，无法可靠显示）', note: '这个有限统计量对应的尾概率在数学上大于 0；当前浮点计算返回了 0，不能把它解释为概率恰为 0。' };
  const rounded = format(probability, 6);
  if (rounded === '1.000000') return { text: 'P ≈ 1.000000', note: '概率在当前计算或显示精度下舍入到 1；这是近似显示，不据此断言数学概率恰为 1。' };
  return { text: `P = ${rounded}`, note: '' };
}

function stableSummary(values) {
  // Center first so repeated decimals and a large common offset do not create
  // artificial variance through summation roundoff.
  const offsets = values.map(value => value - values[0]);
  const center = M.mean(offsets);
  return { mean: values[0] + center, variance: offsets.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1) };
}

export function twoSample(a, b, method = 'welch', confidence = .95) {
  if (!['welch', 'pooled', 'paired'].includes(method) || !(confidence > 0 && confidence < 1)) throw Error('分析设置无效。');
  if (a.length < 2 || b.length < 2 || [...a, ...b].some(x => !Number.isFinite(x))) throw Error('每组至少需要两个有效观测。');
  if (method === 'paired' && a.length !== b.length) throw Error('配对分析要求两组长度相同，且同一位置对应设计中预先确定的一对；不能截短或单独排序一列凑成配对。');
  const n1 = a.length, n2 = b.length, summaryA = stableSummary(a), summaryB = stableSummary(b);
  const meanA = summaryA.mean, meanB = summaryB.mean, varA = summaryA.variance, varB = summaryB.variance;
  let estimate = meanA - meanB;
  let scale = Math.max(Math.abs(meanA), Math.abs(meanB));
  let se, df;
  if (method === 'paired') {
    const differences = stableSummary(a.map((v, i) => v - b[i]));
    estimate = differences.mean;
    scale = Math.max(scale, Math.abs(estimate));
    se = Math.sqrt(differences.variance / n1);
    df = n1 - 1;
  } else if (method === 'pooled') {
    df = n1 + n2 - 2;
    const pooled = ((n1 - 1) * varA + (n2 - 1) * varB) / df;
    se = Math.sqrt(pooled * (1 / n1 + 1 / n2));
  } else {
    const u = varA / n1, v = varB / n2;
    se = Math.sqrt(u + v);
    df = (u + v) ** 2 / (u * u / (n1 - 1) + v * v / (n2 - 1));
  }
  if (!(se > 0) || !Number.isFinite(se) || !Number.isFinite(df) || se < 10 * Number.EPSILON * scale) throw Error('标准误为 0 或接近数值精度：数据（或配对差值）没有可用变异，常规 t 检验与区间无法稳定计算。请检查数据与实验设计。');
  const t = estimate / se, p = clamp(M.betaCDF(df / (df + t * t), df / 2, .5)), critical = M.studentQuantile((1 + confidence) / 2, df);
  return { n1, n2, meanA, meanB, varA, varB, estimate, se, df, t, p, low: estimate - critical * se, high: estimate + critical * se, critical };
}

// Use relative coordinates so changing units or adding a common baseline does
// not flatten the observations. Tick labels describe the display scale only.
export function twoSampleAxis(values) {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw Error('绘图需要有限观测值。');
  const min = Math.min(...values), max = Math.max(...values), range = max - min;
  if (!Number.isFinite(range)) throw Error('数据范围超出可绘制的数值范围。');
  const span = range || Math.max(Math.abs(min) * .2, min === 0 ? 2 : Number.MIN_VALUE);
  const constantShift = range ? 0 : .5;
  const offset = Math.abs(min) / span >= 10 ? min : 0;
  const low = min - offset + (-.12 - constantShift) * span;
  const high = min - offset + (1.12 - constantShift) * span;
  const magnitude = Math.max(Math.abs(low), Math.abs(high));
  const exponent = magnitude >= 100 || magnitude < 1 ? Math.max(-323, Math.floor(Math.log10(magnitude))) : 0;
  const unit = 10 ** exponent, scaledSpan = span / unit, scaledBase = (min - offset) / unit;
  const step = scaledSpan * 1.24 / 4;
  const decimals = Math.max(0, 2 - Math.floor(Math.log10(step)));
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const value = scaledBase + (i * 1.24 / 4 - .12 - constantShift) * scaledSpan;
    return { position: i / 4, label: String(Number(value.toFixed(decimals))) };
  });
  const scaleNote = offset || exponent
    ? `纵轴实际响应 Y = ${offset ? `${String(offset)} + ` : ''}刻度${exponent ? ` × 1e${exponent}` : ''}。平移与缩放仅用于显示；统计量和 R 代码仍使用原始输入单位。`
    : '纵轴使用原始响应单位；绘图区按当前数据范围自动缩放。';
  return { position: value => ((value - min) / span + constantShift + .12) / 1.24, ticks, offset, exponent,
    label: offset || exponent ? 'Y（局部刻度）' : 'Response Y',
    scaleNote: scaleNote + (range ? '' : '所有观测相同；轴上留白不代表数据有变异。') };
}

export function diagnosticData(mode = 'normal') { return buildDiagnosticData(mode); }

const ns = 'http://www.w3.org/2000/svg';
function add(svg, name, attrs, text = '') { const node = document.createElementNS(ns, name); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); node.textContent = text; svg.append(node); return node; }
function frame(svg, xMin, xMax, yMin, yMax, xLabel, yLabel, yTickFormat = null) {
  svg.replaceChildren();
  const x = value => 72 + (value - xMin) / (xMax - xMin) * 518;
  const y = value => 258 - (value - yMin) / (yMax - yMin) * 207;
  add(svg, 'line', { x1: 72, x2: 590, y1: 258, y2: 258, class: 'wbench-axis' });
  add(svg, 'line', { x1: 72, x2: 72, y1: 51, y2: 258, class: 'wbench-axis' });
  for (let i = 0; i <= 4; i++) {
    const xv = xMin + (xMax - xMin) * i / 4, yv = yMin + (yMax - yMin) * i / 4;
    add(svg, 'text', { x: x(xv), y: 281, 'text-anchor': 'middle', class: 'wbench-tick' }, format(xv, 1));
    add(svg, 'text', { x: 62, y: y(yv) + 5, 'text-anchor': 'end', class: 'wbench-tick' }, yTickFormat ? yTickFormat(yv) : format(yv, yMax - yMin < 2 ? 2 : 1));
  }
  add(svg, 'text', { x: 330, y: 311, 'text-anchor': 'middle', class: 'wbench-label' }, xLabel);
  add(svg, 'text', { x: 72, y: 25, class: 'wbench-label' }, yLabel);
  return { x, y };
}
const plot = label => `<svg viewBox="0 0 640 325" role="img" aria-label="${label}"></svg>`;
function label(caption, content) { return `<label>${caption}${content}</label>`; }
const options = rows => rows.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
const field = (id, content) => `<select data-field="${id}">${options(content)}</select>`;
const number = (id, value, min, max, step = 1) => `<input data-field="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}">`;
const read = (root, id) => root.querySelector(`[data-field="${id}"]`);
function listen(root, update) { root.querySelectorAll('input,select,textarea').forEach(el => el.addEventListener('input', update)); update(); }
function errorBox(root, error) { root.querySelector('.wbench-error').textContent = error ? error.message : ''; }
function chapterURL(id, anchor) { const url = new URL(`../chapters/${id}.html`, import.meta.url); if (anchor) url.hash = anchor; return url.href; }

function mountDistribution(root) {
  root.innerHTML = `<h2>分布与尾部概率</h2><p>把统计量放进 H₀ 的 reference distribution，阴影才有概率含义。先选尾，再移动统计量。</p><div class="wbench-controls">${label('参考分布', field('kind', [['normal', 'Standard normal Z'], ['t', 'Student t'], ['chi', 'Chi-square χ²'], ['f', 'F distribution']]))}${label('备择方向 / tail', field('tail', [['right', '右尾：较大值反驳 H₀'], ['left', '左尾：较小值反驳 H₀'], ['two', '双尾：两端等尾概率']]))}${label('df / numerator df', number('df1', 10, 1, 100))}${label('Denominator df（F）', number('df2', 20, 1, 100))}${label('观测统计量', number('observed', 2, -10000, 10000, .1))}${label('显著性水平 α', field('alpha', [['0.05', '0.05'], ['0.01', '0.01'], ['0.1', '0.10']]))}</div><p class="wbench-error" role="alert"></p>${plot('参考分布密度；绿色尾部对应 P-value，棕色虚线为显著性水平临界值')}<div class="wbench-result" aria-live="polite"></div><p class="wbench-note wbench-window-note"></p><p class="wbench-note">实线为观测值，棕色虚线为 α 的临界值。图中阴影只展示当前视窗内的尾部位置；P-value 与临界值始终按完整分布计算。χ² / F 的双尾采用 2 × min(左尾, 右尾)，不同 exact tests 可能使用其他双尾定义。</p>`;
  listen(root, () => {
    const kind = read(root, 'kind').value;
    read(root, 'df1').disabled = kind === 'normal';
    read(root, 'df2').disabled = kind !== 'f';
    const out = root.querySelector('.wbench-result'), svg = root.querySelector('svg');
    try {
      for (const key of ['df1', 'df2', 'observed']) if (!read(root, key).disabled && !read(root, key).value.trim()) throw Error('请输入完整的统计量与自由度。');
      const df1 = read(root, 'df1').disabled ? 10 : +read(root, 'df1').value, df2 = read(root, 'df2').disabled ? 20 : +read(root, 'df2').value, observed = +read(root, 'observed').value, alpha = +read(root, 'alpha').value, tail = read(root, 'tail').value;
      const r = tailProbability(kind, observed, tail, df1, df2, alpha);
      const plan = distributionPlot(kind, df1, df2), { lo, hi, samples, density } = plan;
      const map = frame(svg, lo, hi, 0, plan.yMax, 'Test statistic', 'Density', value => distributionTick(value, plan.yMax / 4));
      for (let i = 0; i < samples.length - 1; i++) {
        const x = samples[i], mid = (x + samples[i + 1]) / 2;
        const inTail = tail === 'two' ? mid <= r.shade[0] || mid >= r.shade[1] : mid >= r.shade[0] && mid <= r.shade[1];
        if (inTail) add(svg, 'rect', { x: map.x(x), y: map.y(density(mid)), width: 518 / 600 + .2, height: map.y(0) - map.y(density(mid)), fill: '#9bc9b5' });
      }
      add(svg, 'path', { d: samples.map((x, i) => `${i ? 'L' : 'M'}${map.x(x)},${map.y(density(x))}`).join(' '), class: 'wbench-curve' });
      if (plan.singular) add(svg, 'path', { d: `M${map.x(0)+2},${map.y(plan.densityCap)-2} l5,-9 l5,9`, stroke: '#9a472e', fill: 'none', 'stroke-width': 2 });
      root.querySelector('.wbench-window-note').textContent = `横轴显示 [${format(lo, 2)}, ${format(hi, 2)}]，图外尾部概率合计约 ${format(plan.omittedMass * 100, 2)}%。${plan.singular ? `密度在 0 附近趋于无穷；高于 ${format(plan.densityCap)} 的部分截去，并用箭头提示，因此图中阴影面积不等于完整 P-value。` : ''}${r.critical.some(x => x < lo || x > hi) ? '部分临界值在图外，请以上方数值为准。' : ''}`;
      r.critical.filter(x => x >= lo && x <= hi).forEach(x => add(svg, 'line', { x1: map.x(x), x2: map.x(x), y1: 42, y2: 258, class: 'wbench-critical' }));
      if (observed >= lo && observed <= hi) add(svg, 'line', { x1: map.x(observed), x2: map.x(observed), y1: 42, y2: 258, class: 'wbench-observed' });
      const probability = distributionProbabilityDisplay(kind, observed, tail, r.p);
      out.innerHTML = `<strong>${probability.text}</strong>${probability.note ? `<span>${probability.note}</span>` : ''}<span>临界值：${r.critical.map(x => format(x)).join(' 与 ')}</span><span>P ${r.reject ? '≤' : '>'} α → ${r.reject ? '拒绝' : '不拒绝'} H₀；这不是 H₀ 为真的概率。</span>${observed < lo || observed > hi ? '<span>观测值在当前绘图区之外；上方概率仍按输入值计算，并标明数值精度限制。</span>' : ''}`;
      errorBox(root);
    } catch (error) { errorBox(root, error); svg.replaceChildren(); out.textContent = '等待有效设置。'; root.querySelector('.wbench-window-note').textContent = ''; }
  });
}

function mountTwoSample(root) {
  root.innerHTML = `<h2>从数据走到两样本结论</h2><p>默认是原创示例数据。估计方向始终是 <strong>A − B</strong>，检验 H₀: μA − μB = 0。切换方法前，先确认实验单位是否独立或配对。</p><div class="wbench-controls">${label('A 组（按观测顺序）', '<textarea data-field="a">8, 10, 13, 14, 18, 20</textarea>')}${label('B 组（按观测顺序）', '<textarea data-field="b">7, 8, 10, 12, 12, 13</textarea>')}${label('分析方法', field('method', [['welch', 'Welch：独立，不要求等方差'], ['pooled', 'Pooled：独立且总体方差相等'], ['paired', 'Paired：设计中预先确定的一对']]))}${label('双侧置信水平', field('confidence', [['0.95', '95%'], ['0.90', '90%'], ['0.99', '99%']]))}</div><p class="wbench-error" role="alert"></p><div class="wbench-result" aria-live="polite"></div><p class="wbench-assumptions"></p>${plot('A、B 两组观测；配对模式中连线表示同一预定 pair')}<p class="wbench-note" data-two-sample-scale></p><details><summary>对照 R：把同样的数据带进软件</summary><pre class="wbench-code"></pre></details><p class="wbench-note">不应先做一次 variance test 再按 P 值机械选择 pooled / Welch。研究设计决定 paired 与 independent；样本方差相似不能证明总体方差相等。这里没有自动删除任何观测。</p>`;
  listen(root, () => {
    const out = root.querySelector('.wbench-result'), svg = root.querySelector('svg');
    try {
      const a = parseSample(read(root, 'a').value), b = parseSample(read(root, 'b').value), method = read(root, 'method').value, confidence = +read(root, 'confidence').value, r = twoSample(a, b, method, confidence);
      errorBox(root);
      out.innerHTML = `<strong>差值 ${format(r.estimate)} · ${confidence * 100}% CI [${format(r.low)}, ${format(r.high)}]</strong><span>SE = ${format(r.se)} · t = ${format(r.t)} · df = ${format(r.df)} · 双侧 P = ${format(r.p, 6)}</span><span>A：n=${r.n1}，mean=${format(r.meanA)}，s²=${format(r.varA)}；B：n=${r.n2}，mean=${format(r.meanB)}，s²=${format(r.varB)}</span><span>α=${format(1 - confidence, 2)}：${r.p <= 1 - confidence ? '有证据认为总体平均差异不为 0' : '目前证据不足以认定总体平均差异不为 0'}。</span>`;
      root.querySelector('.wbench-assumptions').textContent = method === 'paired' ? '前提：各 pair 之间独立；A[i] 与 B[i] 必须对应同一预定 pair，可以是同一个体两次测量，也可以是设计中匹配的两个不同单位。小样本正态性应检查配对差值，不是分别检查 A、B。连接线仅按输入顺序绘制，软件不能验证配对来源。' : method === 'pooled' ? '前提：单位与组间独立；小样本各组近似 normal；两个总体具有相同 variance。pooled df = nA + nB − 2。' : '前提：单位与组间独立；小样本各组近似 normal 且无严重极端值。Welch 调整 SE 与 df，不会修复非独立、强偏态或错误配对。';
      const axis = twoSampleAxis([...a, ...b]), map = frame(svg, 0, 1, 0, 1, 'Group A → Group B', axis.label, value => axis.ticks[Math.round(value * 4)].label);
      const y = value => map.y(axis.position(value));
      root.querySelector('[data-two-sample-scale]').textContent = axis.scaleNote;
      svg.setAttribute('aria-label', `A、B 两组观测；${method === 'paired' ? '连线按输入顺序表示同一预定 pair，不能由软件验证匹配来源。' : '横向错开仅为显示重叠点。'}${axis.scaleNote}`);
      if (method === 'paired') a.forEach((v, i) => add(svg, 'line', { x1: map.x(.2), x2: map.x(.8), y1: y(v), y2: y(b[i]), stroke: '#adc5b9', 'stroke-width': 1.5 }));
      [a, b].forEach((g, j) => { g.forEach((v, i) => add(svg, 'circle', { cx: map.x((j ? .8 : .2) + (method === 'paired' ? 0 : ((i % 5) - 2) * .012)), cy: y(v), r: g.length > 100 ? 2.5 : 4.5, fill: j ? '#9a472e' : '#086f68' })); add(svg, 'text', { x: map.x(j ? .8 : .2), y: 43, 'text-anchor': 'middle', class: 'wbench-label' }, j ? 'B' : 'A'); });
      root.querySelector('.wbench-code').textContent = `# Synthetic or user-supplied observations\na <- c(${a.join(', ')})\nb <- c(${b.join(', ')})\n# Direction: A minus B; two-sided inference\nt.test(a, b, paired = ${method === 'paired' ? 'TRUE' : 'FALSE'},\n       var.equal = ${method === 'pooled' ? 'TRUE' : 'FALSE'}, conf.level = ${confidence})`;
    } catch (error) { errorBox(root, error); svg.replaceChildren(); out.textContent = '等待有效数据。'; root.querySelector('.wbench-code').textContent = ''; root.querySelector('.wbench-assumptions').textContent = ''; root.querySelector('[data-two-sample-scale]').textContent = ''; svg.setAttribute('aria-label', '等待有效的 A、B 两组观测。'); }
  });
}


function chooseLocationMethod({ design, groups, factors, locationTarget }) {
  if (factors === 'two') return { boundary: true, title: '多个 treatment factors：先指定位置目标与模型', chapter: design === 'blocked' ? '15' : '14', anchor: design === 'blocked' ? 'factorial-blocks' : 'interaction', why: '先写清比较哪些 factor levels、是否存在 interaction，以及需要怎样的 averaging 权重。单因素的 sign、rank-sum 或 Kruskal–Wallis 路线不能自动回答 factorial 问题。', caution: '链接用于理解设计与模型结构，不是适用于所有 factorial median / rank 问题的现成检验。若有配对、重复测量或 blocks，还必须保留其依赖结构。' };
  if (design === 'blocked') return { boundary: true, title: '含 blocks 的位置问题：保留随机化与依赖结构', chapter: '15', anchor: 'blocking', why: '先定义 block 内比较的参数，再选择尊重 blocks 的模型或允许的随机化。不能把同 block 的观测直接当作普通独立组。', caution: '普通独立组 rank-sum / Kruskal–Wallis 不会自动调整 blocks。该链接解释设计基础；是否能化成独立的预定两条件差值，仍须由实际设计决定。' };
  if (design === 'paired' && groups !== 'two') return { boundary: true, title: '相关观测：先明确可分析的差值或重复测量模型', chapter: '06', anchor: 'paired-t', why: '这里的配对路线需要每个预定 pair 各有一个 A、B，并先定义差值方向。一个条件或三个及以上相关条件，尚未给出这种两条件差值问题。', caution: '不能为了运行 sign / signed-rank 随意生成 pairs，也不能把重复测量当成独立组做 Kruskal–Wallis。链接说明配对结构，不表示此时应采用 paired t。' };
  if (locationTarget === 'median') {
    if (design === 'paired') return { title: '配对差值的 median：Sign test', chapter: '05', anchor: 'median', why: '按预先确定的 pairs 和方向计算 D=A−B，再针对 median(D)=D₀ 记录正负号。目标 median(A−B) 一般不等于两个边际 medians 的差；各 pairs 应独立。', caution: 'Sign test 不要求差分布对称，但连续差分布及 H₀ 下正负号各 .5 的公平符号条件仍须成立；以非零差数 m 的 Binomial(m,.5) 为参考。零差、离散值或大量 ties 时，不能仅删零就假定条件成立。' };
    if (groups === 'one') return { title: '单总体 median：Sign test', chapter: '05', anchor: 'median', why: '研究参数是总体 median。对独立同分布观测计算 Y−M₀，只记录正负号；不因偏态就把科学目标从 mean 自动改成 median。', caution: '连续总体、H₀ 下正负号各 .5 时，可用非零观测数 m 的 Binomial(m,.5) 参考。不要求对称；零差、离散值或大量 ties 时须核对公平符号条件，删零本身不能保证它成立。' };
    return { boundary: true, title: '独立组的 median 比较：先补充位置模型', chapter: groups === 'two' ? '06' : '08', anchor: groups === 'two' ? 'rank-sum' : 'kruskal', why: '两组或多组的 medians 相等，不能单独保证组标签可交换。Rank-sum / Kruskal–Wallis 的基本 null 是同分布；只有共同形状、尺度及 location-shift 模型等依据支持时，才可进一步按位置或 median 差解释。', caution: '链接说明秩方法的适用边界，并未解决任意不同形状总体的 median 比较。不要把独立组强行配成差值，也不要根据哪种方法 P 更小来更换目标。' };
  }
  if (locationTarget === 'symmetric') {
    if (design === 'paired' || groups === 'one') return { title: design === 'paired' ? '对称差分布的中心：Wilcoxon signed-rank' : '单总体的对称中心：Wilcoxon signed-rank', chapter: '06', anchor: 'signed-rank', why: design === 'paired' ? '先按设计中的真实 pairs 计算 D=A−B，再减去假设中心 D₀。对差分布的对称性有依据时，用差的方向与绝对差 ranks 检查中心偏移；各 pairs 应独立。' : '对独立同分布观测先计算 D=Y−M₀，再按 |D| 排序并保留符号。这里 M₀ 是对称位置模型的中心，在该模型下也是 median。', caution: '需要差分布的对称性，使 H₀ 下符号与绝对大小符合参考分布；不是任意偏态总体的 median 检验。明确零差处理与 average ranks，核对有无 ties、exact 符号枚举或近似参考的条件与双侧定义。' };
    return { boundary: true, title: '各组对称仍不足以指定独立组的位置检验', chapter: groups === 'two' ? '06' : '08', anchor: groups === 'two' ? 'rank-sum' : 'kruskal', why: '各组分别对称，不保证它们具有共同形状或尺度，也不会生成 pairs。Signed-rank 的单总体 / 配对差中心问题与独立组比较不同。', caution: '若希望把 rank-sum / Kruskal–Wallis 解释为中心位移，还需共同形状与 location-shift 等模型依据；不能仅凭各组对称就作这种解释。链接用于核对边界，不是当前设置下的自动处方。' };
  }
  if (locationTarget === 'distribution') {
    if (design === 'paired') return { boundary: true, title: '相关两条件的分布比较：先明确目标与相关模型', chapter: '06', anchor: 'signed-rank', why: '配对观测不能套用独立组 rank-sum。若真正的问题是配对差的对称中心，才可在相应条件下考虑 signed-rank；任意差分布不能自动作此解释。', caution: '链接只说明 signed-rank 的差值、对称性与参考分布。它不是任意两种相关分布相同的通用检验；需要先明确研究参数或合适的相关数据方法。' };
    if (groups === 'one') return { boundary: true, title: '单总体的分布问题：尚未指定比较对象', chapter: '05', anchor: 'median', why: '目前只有一个总体，尚未说明要与哪个分布或哪种性质比较。独立组 rank-sum / Kruskal–Wallis 至少需要两个组。', caution: '链接仅介绍单总体 median 的位置目标基础，不是一般的分布拟合优度检验。先定义要比较的分布或参数，再选择相应方法。' };
    return { title: groups === 'two' ? '独立两组的秩比较：Wilcoxon rank-sum' : '多个独立组的秩比较：Kruskal–Wallis', chapter: groups === 'two' ? '06' : '08', anchor: groups === 'two' ? 'rank-sum' : 'kruskal', why: '研究各组是否系统性占据更高或更低的 ranks；基本 null 是各组同分布。需要独立观测，标签枚举还须满足给定组大小下的可交换性。', caution: `${groups === 'two' ? 'Ties 用 average ranks；核对 exact / permutation 或含 tie correction 的近似参考。' : 'Ties 用 average ranks 并核对 H 的 tie correction；小样本核对 exact / permutation，χ²(k−1) 是大样本近似。整体拒绝不能确定哪一对不同，也不指定某组更大。'}它不是所有分布差异的通用检测，也不是 mean test；只有共同形状、尺度及 location-shift 等条件支持时，才可进一步解释为位置或 median 差。` };
  }
  return { boundary: true, title: '先明确位置问题的研究参数', chapter: '05', anchor: 'median', why: '请选择总体 / 配对差的 median、已有对称性依据的中心，或独立组的分布 / 秩位置比较。', caution: '这些目标不能仅凭数据非正态而互换。链接用于理解 median 目标，不表示当前信息已足够指定检验。' };
}

export function chooseMethod({ goal = 'mean', design = 'independent', groups = 'two', factors = 'one', equal = 'unsure', locationTarget = 'median' } = {}) {
  // Equal marginal variances do not select a location/rank route. Conversely,
  // a saved locationTarget has no effect while a different goal is active.
  if (goal === 'location') return chooseLocationMethod({ design, groups, factors, locationTarget });
  if (goal === 'describe') return { title: '先画数据，再报告 center 与 spread', chapter: '01', anchor: 'variables', why: '连续变量用 histogram、boxplot 和合适的摘要；categorical variables 用 counts 与 proportions。Mean 容易受极端值影响。', caution: '先定义 observation、experimental unit 与测量单位；描述本身不能推出总体因果效应。' };
  if (goal === 'variance') {
    if (design === 'paired') return { title: '相关观测的 variance：先明确参数与依赖结构', chapter: '07', anchor: 'practice', why: '目标可能是各次测量的边际 variance、配对差值的 variance，或单位内的误差 variance；三者不同。重复测量的原始行不能当作独立样本。', caution: '需要适用于相关观测的方差模型或检验。普通 χ²、独立样本 F，以及独立组 Levene / Brown–Forsythe 都不能直接套用；本课程该章仅提供独立样本的基础与适用边界。' };
    if (design === 'blocked') return { title: '含 blocks 的 variance：区分背景与误差变异', chapter: '15', anchor: 'random-effects', why: '先区分 block variance component、block 内误差 variance，以及各 treatment 的边际 variance。Fixed / random block 的选择取决于推断目标。', caution: '应在匹配 block 结构的模型中提出方差问题；不能把含 block 背景的 raw observations 直接送入独立组 F 或 Brown–Forsythe。本章 random-block 例只覆盖其明确写出的加性模型。' };
    if (groups === 'many' && factors === 'two') return { title: '独立 factorial cells：按完整组合诊断共同 variance', chapter: '14', anchor: 'factorial-bf-cells', why: '以完整 treatment combinations 为组，比较每个 cell 内到该 cell 中位数的绝对偏差。不能只按一个因素混合不同 cell means。', caution: '这条 Brown–Forsythe 路线仍要求独立实验单位；不是 mean test，也不能处理被忽略的 blocks 或 repeated measurements。' };
    return { title: groups === 'one' ? '独立 normal 总体的 variance：χ² pivot' : groups === 'two' ? '两个独立总体 variance：F ratio / 稳健方差诊断' : '多个独立总体 variance：Levene / Brown–Forsythe', chapter: '07', anchor: groups === 'one' ? 'variance-ci' : groups === 'two' ? 'f-distribution' : 'brown-forsythe', why: '研究目标是稳定性，参数是 σ²。单总体 χ² 和经典两总体 F 检验对 normality 敏感；Brown–Forsythe 比较各组到中位数的绝对偏差。', caution: '单位与组间独立是本路线的前提。方差检验不检验 mean；未拒绝也不证明方差完全相同。' };
  }
  if (goal === 'relationship') {
    if (design === 'paired') return { title: '重复单位的连续关系：区分单位内与单位间关联', chapter: '11', anchor: 'slr', why: '同一单位贡献多行，或不同单位因预先匹配而相关时，需考虑相关误差、pair/block 调整、repeated-measures 或 mixed regression。若每个独立单位只记录一对 (X,Y)，应选“单位之间独立”；X 与 Y 成对记录本身不意味着误差相关。', caution: '不能将重复行直接代入普通独立误差 SLR 的 SE、CI / PI。本章链接解释 SLR 基础；相关数据的完整模型还需要额外设计信息和方法。' };
    if (design === 'blocked') return { title: '含 blocks 的连续关系：在回归中保留背景结构', chapter: '15', anchor: 'random-effects', why: '连续 predictor 与 block 承担不同角色；需按研究目标考虑 block-adjusted regression 或适当的 random-block model，再解释 slope。', caution: '不能默认把 blocks 混合后的一条 SLR 当作条件关系。课程链接解释 block 及 covariance 的作用，不是所有相关回归模型的完整实现。' };
    return { title: '独立单位的连续关系：simple linear regression', chapter: '11', anchor: 'slr', why: '每个独立单位记录一对 (X,Y)，用 slope 描述 X 改变时 conditional mean 的变化。区分 mean CI 与新观测 PI。', caution: '检查线性、误差 variance、单位间独立性和残差分布；相关不等于因果，避免外推。同一单位多行数据应回到重复观测结构。' };
  }
  if (goal === 'compare') {
    if (design === 'paired') return { title: factors === 'two' ? '重复观测 factorial：模型内的 simple effects / contrasts' : '配对 / 重复观测：先定义具体均值差', chapter: factors === 'two' ? '14' : '06', anchor: factors === 'two' ? 'interaction' : 'paired-t', why: factors === 'two' ? '先说明在哪些 factor levels 比较什么效应，再用处理重复观测相关性的模型估计 contrast 与 SE。' : '某项问题比较同一单位的两个条件，或设计中预先匹配的两个单位时，可用完整 pairs 的差值做 paired t；复杂重复测量 contrasts 需对应的相关模型。', caution: '配对差值推断不要求两列边际 variance 相等。先保证每项检验及其 SE 有效，再对预定 family 做 Bonferroni 等校正；校正不会修复被忽略的相关性，也不要求先拒绝 omnibus。课程链接是基础，不是通用 repeated-measures 分析。' };
    if (design === 'blocked') return { title: 'Block 模型内的调整比较与 family 校正', chapter: '15', anchor: factors === 'two' ? 'factorial-rcbd-worked' : 'missing-block-cell-worked', why: '目标是模型中可估计的 treatment difference、simple effect 或 contrast。保留 block 结构，以 cᵀCov(β̂)c 取得估计方差，再按预定 family 校正。', caution: `${equal === 'yes' ? '共同 residual variance 仍须与 block 模型和正确 error term 相容。' : '没有共同 residual variance 的依据时，还需匹配的异方差模型；链接的共同方差例不能直接套用。'}不能把 raw treatment means 当作独立组套普通 pooled SE；比较不要求先拒绝 omnibus。` };
    if (factors === 'two') return { title: '独立 factorial：先指定 cell contrast 或 simple effect', chapter: '14', anchor: 'interaction', why: '比较必须写清 factor levels 与 averaging 权重；先解释 interaction，再从完整模型取得可估计 contrast、协方差与 df。', caution: `${equal === 'yes' ? '独立、正态、共同 residual variance 模型下，使用该模型的 MSE 与 df。' : '共同 variance 未获支持时，需要异方差下的模型协方差与相应检验；不能直接合并 cells 套一因素 pooled 公式。'}再按预定 family 调整有效 P 值；不需要先拒绝 omnibus。` };
    if (equal !== 'yes') return { title: '独立组具体均值差：Welch 单项检验 + 预定 family', chapter: '08', anchor: 'welch-anova-complete', why: '若问题是预定的 μᵢ−μⱼ，可分别使用 Welch 检验，再以 Bonferroni（或其他适当方法）校正整个 family。一般线性 contrast 还需与异方差匹配的 SE 和 df。', caution: '每项检验仍要满足独立性及其分布条件；Bonferroni 不要求这些检验彼此独立，但不能修复无效单项 P。不要直接接共同 MSE 的经典 Tukey，也不需要先拒绝 omnibus。' };
    return { title: '独立同方差组：contrast 与匹配的多重校正', chapter: '09', anchor: 'procedures', why: '先定义 comparison family。共同方差模型下，全部 pairwise comparisons 可考虑 Tukey；少量预定 contrasts 可采用 Bonferroni 等对应校正。', caution: '本路线的 pooled SE 与经典 Tukey 需要独立、正态、共同 residual variance 模型。比较不要求先拒绝 omnibus；看结果后不能挑更小 P 的方法或缩小 family。' };
  }
  if (factors === 'two') return { title: 'Factorial model：先解释 interaction', chapter: design === 'blocked' ? '15' : '14', anchor: design === 'blocked' ? 'factorial-blocks' : 'interaction', why: '两个或更多 treatment factors：比较 simple effects，判断一个因素的作用是否依赖另一个因素。处理组合数由各因素 levels 决定。', caution: design === 'paired' ? '重复观测或预先匹配的相关单位还需要对应的 block / repeated-measures / mixed model 处理相关性，不能直接用独立误差的 factorial ANOVA。' : '无重复时 interaction 与 error 可能无法分离；unbalanced data 要说明 weighting 与 sums of squares。若含 blocks，需把 block 结构加入模型。' };
  if (design === 'blocked') return { title: groups === 'one' ? '含 blocks 的 mean：辨认目标总体与不确定性' : 'Blocked design：将 nuisance variation 纳入模型', chapter: '15', anchor: groups === 'one' ? 'random-block-mean-se' : 'blocking', why: groups === 'one' ? '单个 treatment mean 与同 blocks 中的 treatment difference 具有不同 covariance；先明确估计哪个总体 mean。' : 'Treatment 与 block 承担不同角色。RCBD 通常每个 block 包含所有 treatments；Latin square 控制两种 blocking directions。', caution: '检查随机化、缺失 cell、additivity 与正确 error term。多个 blocks 不是重复测量的通用替代方案。' };
  if (design === 'paired' && groups !== 'two') return { title: '相关观测：先明确 repeated / matched 结构', chapter: '06', anchor: 'paired-t', why: 'Paired t 处理每个预定 pair 中各一个 A、B 的差值。三个及以上相关测量通常需要 repeated-measures 或 mixed model。', caution: '本课程的基本独立样本 ANOVA 不能直接用于相关重复测量；需要额外模型与假设。' };
  if (design === 'paired') return { title: 'Paired t：对每个 pair 的差值做 one-sample t', chapter: '06', anchor: 'paired-t', why: '研究参数是总体平均差值。Pair 内允许相关；各 pairs 应独立。有效样本量为 pairs 数量。', caution: '同一位置必须对应设计中预先确定的 pair；可为同一个体或预先匹配的两个单位。小样本正态性检查差值，不是两个 marginal distributions。' };
  if (groups === 'one') return { title: '单总体 mean：one-sample t（σ 未知）', chapter: '05', anchor: 'student', why: '用 (ȳ−μ₀)/(s/√n) 标准化，与 df=n−1 的 t reference distribution 对照；σ 真正已知时才用 z。', caution: '先确定 alternative 方向和 α。小样本需检查 normality / 极端值；P 值不是 H₀ 的概率。' };
  if (groups === 'many') return { title: equal === 'yes' ? 'One-way ANOVA：比较多个总体 means' : '先诊断 variance；必要时考虑 Welch one-way ANOVA', chapter: '08', anchor: equal === 'yes' ? 'model' : 'welch-anova-complete', why: '标准 ANOVA 比较 between-group 与 within-group mean squares。未知 variance 状态时先结合设计和诊断，不按一次检验机械切换。', caution: 'ANOVA 拒绝只表明至少一个 mean 不同。Kruskal–Wallis 是基于 ranks 的分布比较，不是无条件的均值检验。' };
  return { title: equal === 'yes' ? 'Pooled two-sample t：明确的等方差模型' : 'Welch two-sample t：独立两组的常用起点', chapter: '06', anchor: equal === 'yes' ? 'pooled' : 'welch', why: equal === 'yes' ? '共同 variance 由两组自由度加权估计，df=nA+nB−2。' : '分别估计两组 variance，使用 Welch–Satterthwaite df；不需要假定 variance 相等。', caution: 'Independence 必须来自设计。Welch 不会修复严重偏态、非独立数据或不适当的采样。' };
}

function mountChooser(root) {
  root.innerHTML = `<h2>从研究问题选择方法</h2><p>先告诉自己“想估计什么、数据如何产生”，再考虑计算公式。结果是学习入口，具体分析仍要检查模型条件。</p><div class="wbench-controls">${label('研究目标', field('goal', [['mean', '比较总体 mean'], ['location', '中位数与秩位置'], ['variance', '比较稳定性 / variance'], ['relationship', '连续变量关系与预测'], ['compare', '具体均值比较与多重校正'], ['describe', '描述样本数据']]))}${label('位置问题的具体目标', field('locationTarget', [['median', '单总体 / 配对差的 median'], ['symmetric', '对称中心（已有对称性依据）'], ['distribution', '独立组的分布 / 秩位置']]))}${label('观测结构', field('design', [['independent', '单位之间独立 / 独立组'], ['paired', '预先配对 / 同一单位重复观测'], ['blocked', '有明确 nuisance blocks']]))}${label('总体 / 处理条件数', field('groups', [['two', '两个'], ['one', '一个'], ['many', '三个及以上']]))}${label('Treatment factors', field('factors', [['one', '一个因素'], ['two', '两个或更多因素']]))}${label('共同 variance 假设', field('equal', [['unsure', '未知或没有充分理由'], ['yes', '有科学与诊断依据支持']]))}</div><div class="wbench-result" aria-live="polite"></div>`;
  listen(root, () => {
    const state = Object.fromEntries(['goal', 'design', 'groups', 'factors', 'equal', 'locationTarget'].map(key => [key, read(root, key).value]));
    const relevant = {
      locationTarget: state.goal === 'location',
      design: ['mean', 'variance', 'relationship', 'compare', 'location'].includes(state.goal),
      groups: ['variance', 'location'].includes(state.goal) || (state.goal === 'mean' && state.factors !== 'two'),
      factors: ['mean', 'compare', 'location'].includes(state.goal) || (state.goal === 'variance' && state.design === 'independent' && state.groups === 'many'),
      equal: (state.goal === 'compare' && state.design !== 'paired') || (state.goal === 'mean' && state.design === 'independent' && state.factors === 'one' && state.groups !== 'one')
    };
    for (const [key, active] of Object.entries(relevant)) { read(root, key).disabled = !active; read(root, key).closest('label').classList.toggle('wbench-inactive', !active); }
    read(root, 'locationTarget').closest('label').hidden = !relevant.locationTarget;
    const result = chooseMethod(state);
    root.querySelector('.wbench-result').innerHTML = `${result.boundary ? '<span class="wbench-error">需要先补充模型或调整问题</span>' : ''}<strong>${result.title}</strong><span>${result.why}</span><span>${result.caution}</span>${state.goal === 'location' ? '<span class="wbench-note">“总体 / 处理条件数”不是 pairs 数量：20 个 pairs 仍是两个条件。目标与设计先于检验；不能仅因非正态就换成秩方法。</span>' : ''}<a href="${chapterURL(result.chapter, result.anchor)}">${result.boundary ? '查看适用边界与基础' : `进入 Chapter ${result.chapter === '01' ? '1–3' : Number(result.chapter)} 对应知识点`} →</a>`;
  });
}

export function mountWorkbench(root) {
  if (root.dataset.workbenchReady) return;
  const mounts = { distribution: mountDistribution, 'two-sample': mountTwoSample, diagnostics: mountDiagnostics, chooser: mountChooser };
  const mount = mounts[root.dataset.workbench];
  if (!mount) return;
  root.classList.add('wbench');
  mount(root);
  root.dataset.workbenchReady = 'true';
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-workbench]').forEach(mountWorkbench);
