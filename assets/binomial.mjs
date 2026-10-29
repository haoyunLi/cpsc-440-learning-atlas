import { binomialPMF } from './math.mjs';

export const binomialDefaults = Object.freeze({ n: 20, p: .85, k: 18, mode: 'right' });
export const binomialOrderingTolerance = 1e-7;
const modes = ['point', 'left', 'right', 'two'];

export function chapterProbabilityLabel(value, complement = 1 - value, digits = 6) {
  if (!Number.isFinite(value) || value < 0 || value > 1) return '—';
  if (value > .5 && complement > 0 && complement < 10 ** -digits) return `1 − ${complement.toExponential(3)}`;
  if (value > 0 && value < .0001) return value.toExponential(3);
  return value === 0 || value === 1 ? String(value) : value.toFixed(digits);
}

export function binomialAnalysis({ n = 20, p = .85, k = 18, mode = 'right' } = {}) {
  if (!Number.isInteger(n) || n < 1 || n > 60 || !Number.isFinite(p) || p < 0 || p > 1 || !Number.isInteger(k) || k < 0 || k > 60 || !modes.includes(mode)) throw new RangeError('n 应为 1–60 的整数，p 应在 0–1，k 应为 0–60 的整数；请选择有效计算对象。');
  if (mode === 'two' && k > n) throw new RangeError(`双侧检验需要实际可能的观测 x∈0…n；当前 x=${k}>n=${n}。请改变 n 或 k，或选择单点 / 单侧概率探索；输入不会自动截断。`);
  const pmf = Array.from({ length: n + 1 }, (_, j) => binomialPMF(j, n, p));
  const observed = k <= n ? pmf[k] : 0;
  const select = predicate => {
    const included = [], excluded = [];
    let mass = 0, other = 0;
    pmf.forEach((value, j) => {
      if (predicate(j, value)) { included.push(j); mass += value; }
      else { excluded.push(j); other += value; }
    });
    // Sum both events directly: subtracting a tiny tail from 1 loses it.
    // If the other event has no positive mass, probability 1 is genuine.
    return { included, excluded, probability: mass === 0 ? 0 : other === 0 ? 1 : Math.min(1, mass), complement: other === 0 ? 0 : mass === 0 ? 1 : Math.min(1, other) };
  };
  const comparisons = {
    point: select(j => j === k),
    left: select(j => j <= k),
    right: select(j => j >= k),
    two: k <= n ? select((j, value) => value <= observed * (1 + binomialOrderingTolerance)) : null
  };
  return { n, p, k, mode, pmf, observed, comparisons, ...comparisons[mode], mean: n * p, sd: Math.sqrt(n * p * (1 - p)) };
}

// Preserve the original chapter API while the UI gains additional events.
export function binomialTailSummary(n, p, k) {
  const r = binomialAnalysis({ n, p, k, mode: 'right' });
  return { pmf: r.pmf, right: r.probability, below: r.complement };
}

export function binomialRCode(settings = binomialDefaults) {
  const { n, p, k, mode } = binomialAnalysis(settings);
  return `# A fixed binomial model: independent trials with the same success probability.
# In the test comparison, p0 is the prespecified null success probability.
n <- ${n}
p0 <- ${p}
x <- ${k}
mode <- "${mode}"
counts <- 0:n
pmf <- dbinom(counts, size=n, prob=p0)
observed_mass <- dbinom(x, size=n, prob=p0)
# R's probability-ordering rule uses a relative tolerance, not an added 1e-7.
relative_tolerance <- 1e-7
two_included <- if (x <= n) pmf <= observed_mass*(1+relative_tolerance) else rep(NA, n+1)
included <- switch(mode, point=counts==x, left=counts<=x,
                   right=counts>=x, two=two_included)
selected_probability <- sum(pmf[included])
complement_probability <- sum(pmf[!included])
print(data.frame(count=counts, pmf=pmf, observed=counts==x,
                 included=included, contribution=ifelse(included, pmf, 0)))
print(counts[included])
print(c(selected_probability=selected_probability,
        complement_probability=complement_probability))
# These four numbers answer different questions. Both one-sided events include x.
comparisons <- c(point=dbinom(x,n,p0), left=pbinom(x,n,p0),
                 right=pbinom(x-1,n,p0,lower.tail=FALSE),
                 two=if(x<=n) binom.test(x,n,p=p0,alternative="two.sided")$p.value else NA_real_)
print(comparisons)
stopifnot(isTRUE(all.equal(selected_probability, unname(comparisons[mode]), tolerance=1e-10)))
if (x <= n) {
  # Check the entire probability-ordered sum against the exact two-sided test.
  stopifnot(isTRUE(all.equal(sum(pmf[two_included]), unname(comparisons["two"]), tolerance=1e-10)))
  if (mode %in% c("left","right","two")) {
    # The alternative must come from the research question, before seeing x.
    alternative <- switch(mode, left="less", right="greater", two="two.sided")
    print(binom.test(x,n,p=p0,alternative=alternative))
  }
}
# A single point mass is not a P-value. No normal approximation is used here.
# The interval printed by binom.test is Clopper-Pearson; its definition is
# different from the probability-ordering rule for the two-sided P-value.`;
}

export function binomialGeometry(result) {
  const left = 82, right = 690, top = 44, bottom = 270;
  const maximum = Math.max(...result.pmf) * 1.12;
  const x = j => left + (j + .5) / (result.n + 1) * (right - left);
  const y = probability => bottom - probability / maximum * (bottom - top);
  const width = (right - left) / (result.n + 1) * .76;
  const included = new Set(result.included);
  return { left, right, top, bottom, maximum, bars: result.pmf.map((probability, j) => ({ j, x: x(j) - width / 2, y: y(probability), width, height: probability / maximum * (bottom - top), probability, included: included.has(j), observed: j === result.k })), observed: result.k <= result.n ? { x: x(result.k), y: y(result.observed) } : null, x, y };
}

const names = { point: '单点概率', left: '包含 k 的左尾', right: '包含 k 的右尾', two: '概率排序的双侧 P-value' };
const probabilityText = r => chapterProbabilityLabel(r.probability, r.complement);
const eventText = r => r.mode === 'point' ? `P(X=${r.k})` : r.mode === 'left' ? `P(X≤${r.k})` : r.mode === 'right' ? `P(X≥${r.k})` : '双侧 P（probability ordering）';
const svgNS = 'http://www.w3.org/2000/svg';
function add(svg, name, attrs, text = '') {
  const node = (svg.ownerDocument || document).createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  svg.append(node); return node;
}
export function drawBinomial(svg, result) {
  svg.replaceChildren();
  const g = binomialGeometry(result);
  add(svg, 'text', { x: g.left, y: 23, class: 'binom-chart-label' }, 'PMF：P(X=j)');
  add(svg, 'line', { x1: g.left, x2: g.right, y1: g.bottom, y2: g.bottom, class: 'binom-axis' });
  add(svg, 'line', { x1: g.left, x2: g.left, y1: g.top, y2: g.bottom, class: 'binom-axis' });
  for (let i = 0; i <= 4; i++) {
    const value = g.maximum * i / 4;
    add(svg, 'text', { x: g.left - 10, y: g.y(value) + 5, 'text-anchor': 'end', class: 'binom-chart-tick' }, value === 0 ? '0' : String(Number(value.toPrecision(3))));
  }
  const step = Math.max(1, Math.ceil(result.n / 6));
  const ticks = [...new Set([...Array.from({ length: Math.floor(result.n / step) + 1 }, (_, i) => i * step), result.n])];
  // Avoid a nearly duplicate terminal tick while keeping both endpoints.
  if (ticks.length > 2 && ticks.at(-1) - ticks.at(-2) < step * .6) ticks.splice(-2, 1);
  for (const j of ticks) add(svg, 'text', { x: g.x(j), y: 296, 'text-anchor': 'middle', class: 'binom-chart-tick' }, String(j));
  for (const bar of g.bars) {
    const node = add(svg, 'rect', { x: bar.x, y: bar.y, width: bar.width, height: bar.height, fill: bar.included ? '#086f68' : '#dce3dd', 'data-binom-j': bar.j, 'data-binom-included': String(bar.included), 'data-binom-observed': String(bar.observed) });
    add(node, 'title', {}, `j=${bar.j}；PMF=${chapterProbabilityLabel(bar.probability)}；${bar.included ? '计入本次求和' : '未计入'}${bar.observed ? '；指定计数 k' : ''}`);
  }
  if (g.observed) {
    add(svg, 'line', { x1: g.observed.x, x2: g.observed.x, y1: g.bottom, y2: g.observed.y, stroke: '#9a472e', 'stroke-width': 2, 'stroke-dasharray': '4 3' });
    add(svg, 'circle', { cx: g.observed.x, cy: g.observed.y, r: 5, fill: 'white', stroke: '#9a472e', 'stroke-width': 2 });
  }
  add(svg, 'text', { x: (g.left + g.right) / 2, y: 330, 'text-anchor': 'middle', class: 'binom-chart-label' }, `成功次数 j（计数范围 0…${result.n}）`);
  svg.setAttribute('aria-label', `Binomial(${result.n},${result.p})：柱高是每个计数的 PMF；绿色计入${names[result.mode]}。k=${result.k}${g.observed ? '，空心圆标在该柱实际高度' : '，超出计数范围，图中没有对应柱'}。${eventText(result)}=${probabilityText(result)}。计数与完整 PMF 见下表。`);
}

export function mountBinomial(root) {
  if (root.dataset.binomialReady) return;
  root.classList.add('binom-lab');
  const range = (id, caption, min, max, step, value) => `<label for="${id}">${caption} <output id="${id}-v">${value}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  root.innerHTML = `<h3>同一张 PMF 图，哪些柱要累加？</h3><p>固定 n 次独立试验、相同成功概率 p，令 X 为成功次数。先指定问题，再看计数；单点概率、单侧尾概率和双侧 P-value 回答不同问题。</p>
    <div class="binom-controls">${range('bn', '试验次数 n', 1, 60, 1, 20)}${range('bp', '模型成功概率 p（检验时为 p₀）', 0, 1, .01, .85)}${range('bk', '指定计数 k（双侧时为观测 x）', 0, 60, 1, 18)}<label>计算对象<select data-binom-mode><option value="right">右尾 P(X≥k)</option><option value="point">单点 P(X=k)</option><option value="left">左尾 P(X≤k)</option><option value="two">双侧检验 · probability ordering</option></select></label></div>
    <div class="binom-actions"><button type="button" class="secondary" data-binom-preset>载入不对称正文例</button><button type="button" class="secondary" data-binom-reset>恢复初始设置</button></div>
    <p class="binom-error" data-binom-error role="alert"></p><div class="binom-readout" data-binom-result aria-live="polite"></div>
    <figure class="binom-figure"><svg data-binom-plot viewBox="0 0 720 350" role="img" aria-label="二项概率质量函数"></svg><figcaption>绿色柱计入本次求和；灰色柱未计入。棕色虚线与空心圆标记 k，圆位于该柱实际 PMF 高度。每根柱的高度随概率变化；小到看不见不等于概率为 0。</figcaption></figure>
    <details class="binom-zoom"><summary>放大查看柱图（可横向滚动）</summary><div class="binom-scroll" role="region" aria-label="放大的二项分布图，可横向滚动" tabindex="0"><svg data-binom-zoom-plot viewBox="0 0 720 350" role="img" aria-label="放大的二项概率质量函数"></svg></div></details>
    <div data-binom-comparisons></div><p class="binom-note" data-binom-rule></p>
    <details><summary>检查每个计数的 PMF 与求和贡献</summary><p class="binom-note">表内保留所有 0…n 的计数，包括概率为 0 的项；小屏可在表内横向滚动。“计入”表示属于所选事件，不保证该项概率大于 0。</p><div class="binom-scroll" role="region" aria-label="所有二项计数的概率与求和贡献，可横向滚动" tabindex="0"><table><caption>完整 PMF 表</caption><thead><tr><th scope="col">计数 j</th><th scope="col">P(X=j)</th><th scope="col">j=k？</th><th scope="col">计入求和？</th><th scope="col">贡献</th></tr></thead><tbody data-binom-rows></tbody></table></div></details>
    <details><summary>用当前设置在 base R 中复算</summary><button type="button" class="secondary" data-binom-copy>复制当前 R 代码</button><pre data-binom-code></pre><p data-binom-copy-status class="binom-note" role="status"></p></details>
    <p class="binom-note">在检验解释中，p₀ 是 H₀ 的成功概率，不是本次观察比例 x/n。左尾或右尾只有在事先指定对应 alternative 时才是单侧 P-value；不要看到结果后选择较小的 P。这里没有自动把概率判断推广到不独立、成功概率变化或有抽样偏差的数据。<a href="#exact-binomial-test">回到精确二项检验的手算与适用条件 →</a></p>`;
  const $ = selector => root.querySelector(selector);
  const controls = { n: $('#bn'), p: $('#bp'), k: $('#bk'), mode: $('[data-binom-mode]') };
  const plots = [$('[data-binom-plot]'), $('[data-binom-zoom-plot]')];
  let revision = 0, code = '';
  function update() {
    revision++;
    for (const id of ['bn', 'bp', 'bk']) $(`#${id}-v`).textContent = $(`#${id}`).value;
    $('[data-binom-copy-status]').textContent = '';
    try {
      if ([controls.n, controls.p, controls.k].some(input => input.value.trim() === '')) throw new RangeError('请填写 n、p 与 k；空白不是 0。');
      const r = binomialAnalysis({ n: Number(controls.n.value), p: Number(controls.p.value), k: Number(controls.k.value), mode: controls.mode.value });
      $('[data-binom-error]').textContent = '';
      const included = r.included.length ? r.included.join(', ') : '空集';
      $('[data-binom-result]').innerHTML = `<strong>${eventText(r)} = ${probabilityText(r)}</strong><span>计入的 j：{${included}}。按这些 j 累加 PMF，得到上方结果；补事件概率=${chapterProbabilityLabel(r.complement, r.probability)}。</span><span>E(X)=${Number(r.mean.toPrecision(6))}；SD(X)=${Number(r.sd.toPrecision(6))}。${r.k > r.n ? `k=${r.k}>n=${r.n}，没有对应柱；这种概率事件仍可计算，但不能作为实际观测送入检验。` : r.mode === 'two' ? `H₀:p=${r.p} 对 Hₐ:p≠${r.p}；观测 x=${r.k}，x/n=${(r.k / r.n).toFixed(4)}。` : `模型 p=${r.p}；指定计数 k=${r.k}。`}</span>`;
      plots.forEach(svg => drawBinomial(svg, r));
      $('[data-binom-comparisons]').innerHTML = `<div class="binom-scroll" role="region" aria-label="四种概率的对照，可横向滚动" tabindex="0"><table><caption>同一 n、p、k 的四种问题；当前选择为${names[r.mode]}</caption><thead><tr><th scope="col">计算对象</th><th scope="col">数值</th><th scope="col">所问的问题</th></tr></thead><tbody>${modes.map(mode => `<tr${mode === r.mode ? ' class="binom-current"' : ''}><th scope="row">${names[mode]}${mode === r.mode ? ' · 当前' : ''}</th><td>${r.comparisons[mode] ? probabilityText(r.comparisons[mode]) : '不适用：x>n'}</td><td>${mode === 'point' ? `恰好 ${r.k} 次成功` : mode === 'left' ? `不超过 ${r.k}，包含边界` : mode === 'right' ? `至少 ${r.k}，包含边界` : 'null 下 PMF 不大于观测点的计数'}</td></tr>`).join('')}</tbody></table></div>`;
      $('[data-binom-rule]').textContent = '双侧对照采用 R binom.test 的 probability ordering：累加 PMF(j) ≤ PMF(x)×(1+1e−7) 的计数。1e−7 是处理理论等概率点舍入的相对容差，不是给概率加 1e−7，也不是 α。不对称分布的结果一般不等于 2×较小单尾。单点 PMF 本身不是 P-value；这里没有给出“p₀ 为真的概率”。';
      const selected = new Set(r.included);
      $('[data-binom-rows]').innerHTML = r.pmf.map((value, j) => `<tr${j === r.k ? ' class="binom-observed-row"' : ''}><th scope="row">${j}</th><td>${chapterProbabilityLabel(value)}</td><td>${j === r.k ? '是 · 指定计数' : '否'}</td><td>${selected.has(j) ? '是' : '否'}</td><td>${selected.has(j) ? chapterProbabilityLabel(value) : '0'}</td></tr>`).join('');
      code = binomialRCode(r); $('[data-binom-code]').textContent = code; $('[data-binom-copy]').disabled = false;
    } catch (error) {
      $('[data-binom-error]').textContent = error.message;
      $('[data-binom-result]').textContent = '等待有效设置；下方不显示旧结果。';
      plots.forEach(svg => { svg.replaceChildren(); svg.setAttribute('aria-label', '等待有效的二项分布设置。'); });
      for (const selector of ['[data-binom-comparisons]', '[data-binom-rule]', '[data-binom-rows]', '[data-binom-code]']) $(selector).textContent = '';
      code = ''; $('[data-binom-copy]').disabled = true;
    }
  }
  for (const input of Object.values(controls)) input.addEventListener('input', update);
  controls.mode.addEventListener('change', update);
  const apply = settings => { for (const key of Object.keys(controls)) controls[key].value = String(settings[key]); update(); };
  $('[data-binom-preset]').addEventListener('click', () => apply({ n: 20, p: .2, k: 0, mode: 'two' }));
  $('[data-binom-reset]').addEventListener('click', () => apply(binomialDefaults));
  $('[data-binom-copy]').addEventListener('click', async () => {
    if (!code) return;
    const copiedRevision = revision, copiedCode = code;
    try {
      await navigator.clipboard.writeText(copiedCode);
      $('[data-binom-copy-status]').textContent = copiedRevision === revision ? '已复制当前设置、全部计数与 R 核对代码。' : '已复制点击时的设置；当前设置已改变，请重新复制。';
    } catch { if (copiedRevision === revision) $('[data-binom-copy-status]').textContent = '自动复制不可用；请选中上方完整代码复制。'; }
  });
  update(); root.dataset.binomialReady = 'true';
}
