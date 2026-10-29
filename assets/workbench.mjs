import * as M from './math.mjs';

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
  if (!(df1 >= 2 && df1 <= 100 && df2 >= 3 && df2 <= 100)) throw Error('自由度超出实验范围。');
  const cdf = kind === 'normal' ? x => x < 0 ? normalUpper(-x) : 1 - normalUpper(x) : kind === 't' ? x => M.studentCDF(x, df1) : kind === 'chi' ? x => M.chiCDF(x, df1) : x => M.fCDF(x, df1, df2);
  const survival = kind === 'normal' ? normalUpper : kind === 't' ? x => x >= 0 ? .5 * M.betaCDF(df1 / (df1 + x * x), df1 / 2, .5) : 1 - .5 * M.betaCDF(df1 / (df1 + x * x), df1 / 2, .5) : kind === 'chi' ? x => gammaUpper(x / 2, df1 / 2) : x => x <= 0 ? 1 : M.betaCDF(df2 / (df2 + df1 * x), df2 / 2, df1 / 2);
  const pdf = kind === 'normal' ? M.normalPDF : kind === 't' ? x => Math.exp(M.logGamma((df1 + 1) / 2) - M.logGamma(df1 / 2)) / Math.sqrt(df1 * Math.PI) * (1 + x * x / df1) ** (-(df1 + 1) / 2) : kind === 'chi' ? x => M.chiPDF(x, df1) : x => x > 0 ? Math.exp((df1 / 2) * Math.log(df1 / df2) + (df1 / 2 - 1) * Math.log(x) - ((df1 + df2) / 2) * Math.log1p(df1 * x / df2) - M.logGamma(df1 / 2) - M.logGamma(df2 / 2) + M.logGamma((df1 + df2) / 2)) : 0;
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

export function parseSample(raw) {
  const input = raw.trim();
  if (/^[,，;；]|[,，;；]$|[,，;；]\s*[,，;；]/.test(input)) throw Error('数据中存在空字段；请检查开头、末尾或连续分隔符。空值不能自动替换成 0。');
  const tokens = input.split(/[\s,，;；]+/);
  const values = tokens.map(Number);
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  if (!input || values.length < 2 || values.length > 500 || tokens.some(t => !decimal.test(t)) || values.some(x => !Number.isFinite(x) || Math.abs(x) > 1e6)) throw Error('每组请输入 2–500 个数字（绝对值 ≤ 10⁶），以逗号或空格分隔。');
  return values;
}

export function twoSample(a, b, method = 'welch', confidence = .95) {
  if (!['welch', 'pooled', 'paired'].includes(method) || !(confidence > 0 && confidence < 1)) throw Error('分析设置无效。');
  if (a.length < 2 || b.length < 2 || [...a, ...b].some(x => !Number.isFinite(x))) throw Error('每组至少需要两个有效观测。');
  if (method === 'paired' && a.length !== b.length) throw Error('配对分析要求两组长度相同，且每个位置来自同一个实验单位；不能截短或重新排序凑成配对。');
  const n1 = a.length, n2 = b.length, meanA = M.mean(a), meanB = M.mean(b), varA = M.variance(a), varB = M.variance(b);
  const estimate = meanA - meanB;
  let se, df;
  if (method === 'paired') {
    se = Math.sqrt(M.variance(a.map((v, i) => v - b[i])) / n1);
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
  if (!(se > 0) || !Number.isFinite(se) || !Number.isFinite(df)) throw Error('标准误为 0 或无法稳定计算：数据（或配对差值）没有可用变异，常规 t 检验与区间不适用。请检查数据与实验设计。');
  const t = estimate / se, p = clamp(M.betaCDF(df / (df + t * t), df / 2, .5)), critical = M.studentQuantile((1 + confidence) / 2, df);
  return { n1, n2, meanA, meanB, varA, varB, estimate, se, df, t, p, low: estimate - critical * se, high: estimate + critical * se, critical };
}

export function diagnosticData(mode = 'normal') {
  if (!['normal', 'skew', 'outlier', 'unequal'].includes(mode)) throw Error('未知诊断场景');
  const rng = M.seeded(440);
  const groups = [10, 13, 16].map((center, group) => Array.from({ length: 16 }, (_, i) => {
    const z = M.randomNormal(rng);
    const error = mode === 'skew' ? Math.exp(z * .9) - Math.exp(.405) : z * (mode === 'unequal' ? [0.45, 1, 2.8][group] : 1);
    return center + error + (mode === 'outlier' && group === 2 && i === 15 ? 12 : 0);
  }));
  const fitted = groups.map(M.mean);
  const points = groups.flatMap((group, g) => group.map((value, i) => ({ value, group: g, fitted: fitted[g], residual: value - fitted[g], special: mode === 'outlier' && g === 2 && i === 15 })));
  const sorted = points.map(p => p.residual).sort((a, b) => a - b), n = sorted.length;
  const a = n <= 10 ? .375 : .5;
  const theoretical = sorted.map((_, i) => M.normalQuantile((i + 1 - a) / (n + 1 - 2 * a)));
  const slope = (M.quantile(sorted, .75) - M.quantile(sorted, .25)) / (M.normalQuantile(.75) - M.normalQuantile(.25));
  const intercept = M.quantile(sorted, .25) - slope * M.normalQuantile(.25);
  return { groups, points, sorted, theoretical, slope, intercept, n };
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, name, attrs, text = '') { const node = document.createElementNS(ns, name); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); node.textContent = text; svg.append(node); return node; }
function frame(svg, xMin, xMax, yMin, yMax, xLabel, yLabel) {
  svg.replaceChildren();
  const x = value => 72 + (value - xMin) / (xMax - xMin) * 518;
  const y = value => 258 - (value - yMin) / (yMax - yMin) * 207;
  add(svg, 'line', { x1: 72, x2: 590, y1: 258, y2: 258, class: 'wbench-axis' });
  add(svg, 'line', { x1: 72, x2: 72, y1: 51, y2: 258, class: 'wbench-axis' });
  for (let i = 0; i <= 4; i++) {
    const xv = xMin + (xMax - xMin) * i / 4, yv = yMin + (yMax - yMin) * i / 4;
    add(svg, 'text', { x: x(xv), y: 281, 'text-anchor': 'middle', class: 'wbench-tick' }, format(xv, 1));
    add(svg, 'text', { x: 62, y: y(yv) + 5, 'text-anchor': 'end', class: 'wbench-tick' }, format(yv, yMax - yMin < 2 ? 2 : 1));
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
function chapterURL(id) { return new URL(`../chapters/${id}.html`, import.meta.url).href; }

function mountDistribution(root) {
  root.innerHTML = `<h2>分布与尾部概率</h2><p>把统计量放进 H₀ 的 reference distribution，阴影才有概率含义。先选尾，再移动统计量。</p><div class="wbench-controls">${label('参考分布', field('kind', [['normal', 'Standard normal Z'], ['t', 'Student t'], ['chi', 'Chi-square χ²'], ['f', 'F distribution']]))}${label('备择方向 / tail', field('tail', [['right', '右尾：较大值反驳 H₀'], ['left', '左尾：较小值反驳 H₀'], ['two', '双尾：两端等尾概率']]))}${label('df / numerator df', number('df1', 10, 2, 100))}${label('Denominator df（F）', number('df2', 20, 3, 100))}${label('观测统计量', number('observed', 2, -10000, 10000, .1))}${label('显著性水平 α', field('alpha', [['0.05', '0.05'], ['0.01', '0.01'], ['0.1', '0.10']]))}</div><p class="wbench-error" role="alert"></p>${plot('参考分布密度；绿色尾部对应 P-value，棕色虚线为显著性水平临界值')}<div class="wbench-result" aria-live="polite"></div><p class="wbench-note">实线为观测值，棕色虚线为 α 的临界值。Normal / t 显示 0.1%–99.9% 分位区间；χ² / F 从 0 显示至 99.9% 分位数。尾部概率按完整分布计算。χ² / F 的双尾采用 2 × min(左尾, 右尾)，不同 exact tests 可能使用其他双尾定义。</p>`;
  listen(root, () => {
    const kind = read(root, 'kind').value;
    read(root, 'df1').disabled = kind === 'normal';
    read(root, 'df2').disabled = kind !== 'f';
    const out = root.querySelector('.wbench-result'), svg = root.querySelector('svg');
    try {
      for (const key of ['df1', 'df2', 'observed']) if (!read(root, key).disabled && !read(root, key).value.trim()) throw Error('请输入完整的统计量与自由度。');
      const df1 = read(root, 'df1').disabled ? 10 : +read(root, 'df1').value, df2 = read(root, 'df2').disabled ? 20 : +read(root, 'df2').value, observed = +read(root, 'observed').value, alpha = +read(root, 'alpha').value, tail = read(root, 'tail').value;
      const d = distribution(kind, df1, df2), r = tailProbability(kind, observed, tail, df1, df2, alpha);
      const lo = d.positive ? 0 : d.quantile(.001), hi = d.quantile(.999), samples = Array.from({ length: 601 }, (_, i) => lo + (hi - lo) * i / 600), max = Math.max(...samples.map(x => d.pdf(x || .00001)));
      const map = frame(svg, lo, hi, 0, max * 1.14, 'Test statistic', 'Density');
      for (let i = 0; i < samples.length - 1; i++) {
        const x = samples[i], mid = (x + samples[i + 1]) / 2;
        const inTail = tail === 'two' ? mid <= r.shade[0] || mid >= r.shade[1] : mid >= r.shade[0] && mid <= r.shade[1];
        if (inTail) add(svg, 'rect', { x: map.x(x), y: map.y(d.pdf(mid)), width: 518 / 600 + .2, height: map.y(0) - map.y(d.pdf(mid)), fill: '#9bc9b5' });
      }
      add(svg, 'path', { d: samples.map((x, i) => `${i ? 'L' : 'M'}${map.x(x)},${map.y(d.pdf(x || .00001))}`).join(' '), class: 'wbench-curve' });
      r.critical.filter(x => x >= lo && x <= hi).forEach(x => add(svg, 'line', { x1: map.x(x), x2: map.x(x), y1: 42, y2: 258, class: 'wbench-critical' }));
      if (observed >= lo && observed <= hi) add(svg, 'line', { x1: map.x(observed), x2: map.x(observed), y1: 42, y2: 258, class: 'wbench-observed' });
      out.innerHTML = `<strong>P = ${format(r.p, 6)}</strong><span>临界值：${r.critical.map(x => format(x)).join(' 与 ')}</span><span>P ${r.reject ? '≤' : '>'} α → ${r.reject ? '拒绝' : '不拒绝'} H₀；这不是 H₀ 为真的概率。</span>${observed < lo || observed > hi ? '<span>观测值在当前绘图区之外；上方概率仍按输入值计算。</span>' : ''}`;
      errorBox(root);
    } catch (error) { errorBox(root, error); svg.replaceChildren(); out.textContent = '等待有效设置。'; }
  });
}

function mountTwoSample(root) {
  root.innerHTML = `<h2>从数据走到两样本结论</h2><p>默认是原创示例数据。估计方向始终是 <strong>A − B</strong>，检验 H₀: μA − μB = 0。切换方法前，先确认实验单位是否独立或配对。</p><div class="wbench-controls">${label('A 组（按观测顺序）', '<textarea data-field="a">8, 10, 13, 14, 18, 20</textarea>')}${label('B 组（按观测顺序）', '<textarea data-field="b">7, 8, 10, 12, 12, 13</textarea>')}${label('分析方法', field('method', [['welch', 'Welch：独立，不要求等方差'], ['pooled', 'Pooled：独立且总体方差相等'], ['paired', 'Paired：同一单位内比较']]))}${label('双侧置信水平', field('confidence', [['0.95', '95%'], ['0.90', '90%'], ['0.99', '99%']]))}</div><p class="wbench-error" role="alert"></p><div class="wbench-result" aria-live="polite"></div><p class="wbench-assumptions"></p>${plot('A、B 两组观测；配对模式中连线表示同一实验单位')}<details><summary>对照 R：把同样的数据带进软件</summary><pre class="wbench-code"></pre></details><p class="wbench-note">不应先做一次 variance test 再按 P 值机械选择 pooled / Welch。研究设计决定 paired 与 independent；样本方差相似不能证明总体方差相等。这里没有自动删除任何观测。</p>`;
  listen(root, () => {
    const out = root.querySelector('.wbench-result'), svg = root.querySelector('svg');
    try {
      const a = parseSample(read(root, 'a').value), b = parseSample(read(root, 'b').value), method = read(root, 'method').value, confidence = +read(root, 'confidence').value, r = twoSample(a, b, method, confidence);
      errorBox(root);
      out.innerHTML = `<strong>差值 ${format(r.estimate)} · ${confidence * 100}% CI [${format(r.low)}, ${format(r.high)}]</strong><span>SE = ${format(r.se)} · t = ${format(r.t)} · df = ${format(r.df)} · 双侧 P = ${format(r.p, 6)}</span><span>A：n=${r.n1}，mean=${format(r.meanA)}，s²=${format(r.varA)}；B：n=${r.n2}，mean=${format(r.meanB)}，s²=${format(r.varB)}</span><span>α=${format(1 - confidence, 2)}：${r.p <= 1 - confidence ? '有证据认为总体平均差异不为 0' : '目前证据不足以认定总体平均差异不为 0'}。</span>`;
      root.querySelector('.wbench-assumptions').textContent = method === 'paired' ? '前提：各 pair 之间独立；A[i] 与 B[i] 必须来自同一单位。小样本正态性应检查配对差值，不是分别检查 A、B。连接线仅按输入顺序绘制，软件不能验证配对来源。' : method === 'pooled' ? '前提：单位与组间独立；小样本各组近似 normal；两个总体具有相同 variance。pooled df = nA + nB − 2。' : '前提：单位与组间独立；小样本各组近似 normal 且无严重极端值。Welch 调整 SE 与 df，不会修复非独立、强偏态或错误配对。';
      const values = [...a, ...b], lo = Math.min(...values), hi = Math.max(...values), pad = Math.max((hi - lo) * .12, .5), map = frame(svg, 0, 1, lo - pad, hi + pad, 'Group A → Group B', 'Response');
      if (method === 'paired') a.forEach((v, i) => add(svg, 'line', { x1: map.x(.2), x2: map.x(.8), y1: map.y(v), y2: map.y(b[i]), stroke: '#adc5b9', 'stroke-width': 1.5 }));
      [a, b].forEach((g, j) => { g.forEach((v, i) => add(svg, 'circle', { cx: map.x((j ? .8 : .2) + (method === 'paired' ? 0 : ((i % 5) - 2) * .012)), cy: map.y(v), r: g.length > 100 ? 2.5 : 4.5, fill: j ? '#9a472e' : '#086f68' })); add(svg, 'text', { x: map.x(j ? .8 : .2), y: 43, 'text-anchor': 'middle', class: 'wbench-label' }, j ? 'B' : 'A'); });
      root.querySelector('.wbench-code').textContent = `# Synthetic or user-supplied observations\na <- c(${a.join(', ')})\nb <- c(${b.join(', ')})\n# Direction: A minus B; two-sided inference\nt.test(a, b, paired = ${method === 'paired' ? 'TRUE' : 'FALSE'},\n       var.equal = ${method === 'pooled' ? 'TRUE' : 'FALSE'}, conf.level = ${confidence})`;
    } catch (error) { errorBox(root, error); svg.replaceChildren(); out.textContent = '等待有效数据。'; root.querySelector('.wbench-code').textContent = ''; root.querySelector('.wbench-assumptions').textContent = ''; }
  });
}

function mountDiagnostics(root) {
  root.innerHTML = `<h2>诊断图：先观察，再判断</h2><p>三组、每组 16 个观测，使用固定 seed=440 的教学模拟。改变生成机制，追踪它在两张诊断图里留下的痕迹。</p><div class="wbench-controls">${label('数据生成机制', field('mode', [['normal', 'Normal：同方差基准'], ['skew', 'Skew：右偏误差'], ['outlier', 'Outlier：一个观测额外增加 12'], ['unequal', 'Unequal：各组误差 SD 不同']]))}</div><div class="wbench-actions"><button type="button" data-action="step">逐点显示</button><button type="button" data-action="play">播放诊断过程</button><button type="button" class="secondary" data-action="all">显示全部</button></div><p class="wbench-progress" aria-live="polite"></p><div class="wbench-plots"><figure>${plot('Residual versus fitted：三个组的 residual 离散程度')}<figcaption>Residual vs fitted：找弯曲、漏斗形和极端残差。</figcaption></figure><figure>${plot('Normal Q-Q：排序 residual 与理论 normal quantiles')}<figcaption>Normal Q-Q：沿参考线表示形状较相近；偏离需要结合设计解读。</figcaption></figure></div><div class="wbench-result" aria-live="polite"></div><details><summary>图上的点如何算出来？</summary><p>拟合 one-way ANOVA：fitted = 所在组 mean；residual = observed − fitted。Q-Q 将 48 个 residual 排序，与 Φ⁻¹((i−0.5)/48) 配对。这与 R 的 ppoints(48) 一致；参考线穿过样本与理论的 25%、75% quantiles（R qqline 默认 type 7）。动画仅逐点揭示一次完整拟合结果，不随显示点数重新拟合。</p><p>这些图没有证明 independence 的能力；独立性主要由抽样与实验设计保证。Residual 也并非严格相互独立，图形是模型诊断工具。</p></details>`;
  let timer = null, count = 48;
  const play = root.querySelector('[data-action="play"]');
  function stop() { if (timer) clearInterval(timer); timer = null; play.textContent = '播放诊断过程'; }
  const narratives = {
    normal: '同方差 normal 基准：残差大致围绕 0，各组散布接近。有限样本 Q-Q 不会完美成线；不能把任意偏离都判为失败。',
    skew: '右偏误差：大正残差较突出，Q-Q 上端偏离。关注偏态程度与每组样本量；可讨论有科学意义的变换或更适合的模型，不是只追求一个通过的检验。',
    outlier: '一个观测额外增加 12：它拉高第三组 fitted mean，其余该组 residual 也随之改变。该点始终保留。应核查测量与记录来源，再报告敏感性分析；不能因为不符合预期就删除。',
    unequal: '误差 SD 分别设为 0.45、1、2.8：残差散布随组增大。Pooled ANOVA 的共同 variance 假设值得怀疑；Welch one-way、合理变换或合适的 variance model 是后续方向。'
  };
  function render() {
    const mode = read(root, 'mode').value, data = diagnosticData(mode), svgs = root.querySelectorAll('svg');
    const fit = data.points.map(p => p.fitted), residuals = data.points.map(p => p.residual), ymin = Math.min(...residuals) - .5, ymax = Math.max(...residuals) + .5;
    const left = frame(svgs[0], Math.min(...fit) - 1, Math.max(...fit) + 1, ymin, ymax, 'Fitted group mean', 'Residual');
    add(svgs[0], 'line', { x1: 72, x2: 590, y1: left.y(0), y2: left.y(0), stroke: '#9a472e', 'stroke-dasharray': '5 4' });
    data.points.slice(0, count).forEach(p => add(svgs[0], 'circle', { cx: left.x(p.fitted), cy: left.y(p.residual), r: p.special ? 6 : 4.5, fill: p.special ? '#9a472e' : '#086f68' }));
    const right = frame(svgs[1], -2.5, 2.5, ymin, ymax, 'Theoretical normal quantile', 'Ordered residual');
    const refLo = Math.max(-2.5, (ymin - data.intercept) / data.slope), refHi = Math.min(2.5, (ymax - data.intercept) / data.slope);
    add(svgs[1], 'line', { x1: right.x(refLo), x2: right.x(refHi), y1: right.y(data.intercept + data.slope * refLo), y2: right.y(data.intercept + data.slope * refHi), stroke: '#9a472e', 'stroke-dasharray': '5 4' });
    data.sorted.slice(0, count).forEach((r, i) => add(svgs[1], 'circle', { cx: right.x(data.theoretical[i]), cy: right.y(r), r: 4.5, fill: '#086f68' }));
    root.querySelector('.wbench-progress').textContent = `已显示 ${count} / 48 个点。左图按观测顺序，右图按 residual 大小依次显示。`;
    root.querySelector('.wbench-result').textContent = narratives[mode];
  }
  read(root, 'mode').addEventListener('input', () => { stop(); count = 48; render(); });
  root.querySelector('[data-action="step"]').onclick = () => { stop(); count = count >= 48 ? 1 : count + 1; render(); };
  root.querySelector('[data-action="all"]').onclick = () => { stop(); count = 48; render(); };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncMotion() { if (reduced.matches) stop(); play.disabled = reduced.matches; play.title = reduced.matches ? '减少动态偏好已启用，请用逐点显示按钮。' : ''; }
  syncMotion(); reduced.addEventListener('change', syncMotion);
  play.onclick = () => { if (timer) { stop(); return; } if (count >= 48) count = 0; timer = setInterval(() => { count++; render(); if (count >= 48) stop(); }, 110); play.textContent = '暂停'; };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(root);
  render();
}

export function chooseMethod({ goal = 'mean', design = 'independent', groups = 'two', factors = 'one', equal = 'unsure' } = {}) {
  if (goal === 'describe') return { title: '先画数据，再报告 center 与 spread', chapter: '01', why: '连续变量用 histogram、boxplot 和合适的摘要；categorical variables 用 counts 与 proportions。Mean 容易受极端值影响。', caution: '先定义 observation、experimental unit 与测量单位；描述本身不能推出总体因果效应。' };
  if (goal === 'variance') return { title: groups === 'one' ? '单个总体 variance：χ² pivot' : groups === 'two' ? '两个总体 variance：F ratio / 稳健方差诊断' : '多个总体 variance：Levene / Brown–Forsythe', chapter: '07', why: '研究目标是稳定性，参数是 σ²。单总体 χ² 和经典两总体 F 检验对 normality 敏感；Brown–Forsythe 比较各组到中位数的绝对偏差。', caution: '方差检验不检验 mean。配对或 repeated observations 需要处理其依赖结构，不能直接套独立样本 F 检验。' };
  if (goal === 'relationship') return { title: '连续关系：simple linear regression', chapter: '11', why: '用 slope 描述 X 改变时 conditional mean 的变化；区分 mean confidence interval 和单个新观测 prediction interval。', caution: '检查线性、误差 variance、独立性和残差分布；相关不等于因果，避免外推。' };
  if (goal === 'compare') return { title: '预先指定 contrast，或控制 multiple comparisons', chapter: '09', why: '先定义 comparison family。所有 pairwise comparisons 可考虑 Tukey；少量计划比较按问题定义 contrast，Bonferroni 对依赖结构不作独立要求。', caution: '“整体 ANOVA 显著”不会自动免除所有事后比较的 multiplicity 问题。' };
  if (factors === 'two') return { title: 'Factorial model：先解释 interaction', chapter: '14', why: '两个或更多 treatment factors：比较 simple effects，判断一个因素的作用是否依赖另一个因素。', caution: design === 'paired' ? '同一单位的重复观测还需要 repeated-measures / mixed model 处理相关性，不能直接用独立误差的 factorial ANOVA。' : '无重复时 interaction 与 error 可能无法分离；unbalanced data 要说明 weighting 与 sums of squares。若含 blocks，需把 block 结构加入模型。' };
  if (design === 'blocked') return { title: 'Blocked design：将 nuisance variation 纳入模型', chapter: '15', why: 'Treatment 与 block 承担不同角色。RCBD 通常每个 block 包含所有 treatments；Latin square 控制两种 blocking directions。', caution: '检查随机化、缺失 cell、additivity 与正确 error term。多个 blocks 不是重复测量的通用替代方案。' };
  if (design === 'paired' && groups !== 'two') return { title: '相关观测：先明确 repeated / matched 结构', chapter: '06', why: 'Paired t 只处理每个单位的两个测量。三个及以上相关测量通常需要 repeated-measures 或 mixed model。', caution: '本课程的基本独立样本 ANOVA 不能直接用于相关重复测量；需要额外模型与假设。' };
  if (design === 'paired') return { title: 'Paired t：对每个 pair 的差值做 one-sample t', chapter: '06', why: '研究参数是总体平均差值。Pair 内允许相关；各 pairs 应独立。有效样本量为 pairs 数量。', caution: '顺序必须对应同一实验单位。小样本正态性检查差值，不是两个 marginal distributions。' };
  if (groups === 'one') return { title: '单总体 mean：one-sample t（σ 未知）', chapter: '05', why: '用 (ȳ−μ₀)/(s/√n) 标准化，与 df=n−1 的 t reference distribution 对照；σ 真正已知时才用 z。', caution: '先确定 alternative 方向和 α。小样本需检查 normality / 极端值；P 值不是 H₀ 的概率。' };
  if (groups === 'many') return { title: equal === 'yes' ? 'One-way ANOVA：比较多个总体 means' : '先诊断 variance；必要时考虑 Welch one-way ANOVA', chapter: '08', why: '标准 ANOVA 比较 between-group 与 within-group mean squares。未知 variance 状态时先结合设计和诊断，不按一次检验机械切换。', caution: 'ANOVA 拒绝只表明至少一个 mean 不同。Kruskal–Wallis 是基于 ranks 的分布比较，不是无条件的均值检验。' };
  return { title: equal === 'yes' ? 'Pooled two-sample t：明确的等方差模型' : 'Welch two-sample t：独立两组的常用起点', chapter: '06', why: equal === 'yes' ? '共同 variance 由两组自由度加权估计，df=nA+nB−2。' : '分别估计两组 variance，使用 Welch–Satterthwaite df；不需要假定 variance 相等。', caution: 'Independence 必须来自设计。Welch 不会修复严重偏态、非独立数据或不适当的采样。' };
}

function mountChooser(root) {
  root.innerHTML = `<h2>从研究问题选择方法</h2><p>先告诉自己“想估计什么、数据如何产生”，再考虑计算公式。结果是学习入口，具体分析仍要检查模型条件。</p><div class="wbench-controls">${label('研究目标', field('goal', [['mean', '比较总体 mean'], ['variance', '比较稳定性 / variance'], ['relationship', '连续变量关系与预测'], ['compare', 'ANOVA 之后的具体比较'], ['describe', '描述样本数据']]))}${label('观测结构', field('design', [['independent', '独立单位 / 独立组'], ['paired', '同一单位的配对或重复观测'], ['blocked', '有明确 nuisance blocks']]))}${label('总体 / 处理组数', field('groups', [['two', '两个'], ['one', '一个'], ['many', '三个及以上']]))}${label('Treatment factors', field('factors', [['one', '一个因素'], ['two', '两个或更多因素']]))}${label('共同 variance 假设', field('equal', [['unsure', '未知或没有充分理由'], ['yes', '有科学与诊断依据支持']]))}</div><div class="wbench-result" aria-live="polite"></div>`;
  listen(root, () => {
    const state = Object.fromEntries(['goal', 'design', 'groups', 'factors', 'equal'].map(key => [key, read(root, key).value]));
    const relevant = { design: state.goal === 'mean', groups: ['mean', 'variance'].includes(state.goal), factors: state.goal === 'mean', equal: state.goal === 'mean' && state.design === 'independent' && state.factors === 'one' && state.groups !== 'one' };
    for (const [key, active] of Object.entries(relevant)) { read(root, key).disabled = !active; read(root, key).closest('label').classList.toggle('wbench-inactive', !active); }
    const result = chooseMethod(state);
    root.querySelector('.wbench-result').innerHTML = `<strong>${result.title}</strong><span>${result.why}</span><span>${result.caution}</span><a href="${chapterURL(result.chapter)}">进入 Chapter ${result.chapter === '01' ? '1–3' : Number(result.chapter)} 学习与练习 →</a>`;
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
