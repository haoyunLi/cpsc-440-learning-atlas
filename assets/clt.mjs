import { seeded, mean } from './math.mjs';

export const CLT_LIMIT = 3000;
const SEED = 440;
const validN = n => { if (!Number.isInteger(n) || n < 1 || n > 100) throw Error('每组观测数 n 必须是 1–100 之间的整数。'); return n; };
const validValues = values => {
  if (!Array.isArray(values) || values.length > CLT_LIMIT || values.some(value => !Number.isFinite(value) || value <= 0)) throw Error('模拟值必须是有限正数。');
};
const number = value => value !== null && Number.isFinite(value) ? value < .0001 && value !== 0 ? value.toExponential(4) : value.toFixed(5) : '尚未定义';
const tick = value => String(Number(value.toPrecision(3)));

export function createCLTSimulation(initialN = 10) {
  let n = validN(initialN), rng = seeded(SEED), means = [], latest = null;
  const snapshot = () => {
    const center = means.length ? mean(means) : null;
    const sd = means.length > 1 ? Math.sqrt(means.reduce((sum, value) => sum + (value - center) ** 2, 0) / (means.length - 1)) : null;
    return { n, B: means.length, total: n * means.length, seed: SEED, limit: CLT_LIMIT,
      means: [...means], latest: latest ? { ...latest, values: [...latest.values] } : null,
      meanOfMeans: center, sdOfMeans: sd,
      theoreticalSE: 1 / Math.sqrt(n), remaining: CLT_LIMIT - means.length };
  };
  return {
    snapshot,
    reset(nextN = n) {
      validN(nextN); n = nextN; rng = seeded(SEED); means = []; latest = null;
      return snapshot();
    },
    draw(requested = 1) {
      if (!Number.isInteger(requested) || requested < 1 || requested > CLT_LIMIT) throw Error('每次请求需为 1–3000 组。');
      const added = Math.min(requested, CLT_LIMIT - means.length);
      for (let i = 0; i < added; i++) {
        const values = []; let sum = 0;
        for (let j = 0; j < n; j++) { const value = -Math.log(rng()); values.push(value); sum += value; }
        const average = sum / n;
        means.push(average); latest = { values, sum, mean: average, index: means.length };
      }
      return { ...snapshot(), added };
    }
  };
}

export function cltHistogram(means) {
  validValues(means);
  const high = Math.max(2, ...means), bins = 24, width = high / bins, counts = Array(bins).fill(0);
  means.forEach(value => counts[Math.min(bins - 1, Math.floor(value / high * bins))]++);
  return { high, width, counts, maximumCount: Math.max(4, Math.ceil(Math.max(...counts) * 1.15 / 4) * 4) };
}

export function cltRCode(values) {
  validValues(values);
  if (!values.length || values.length > 100) throw Error('先抽取一组 1–100 个原始观测。');
  return `# The current displayed sample, copied without generating new values.
y <- c(${values.join(', ')})
n <- length(y)
print(data.frame(observation=seq_along(y), value=y))
print(c(n=n, sum=sum(y), sample_mean=mean(y),
        population_mean=1, population_SD=1, theoretical_SE=1/sqrt(n)))
# sd(y) describes observations within this sample, not repeated sample means.
if (n > 1) print(c(within_sample_SD=sd(y)))
# This checks one displayed sample; it does not reconstruct the simulation history.`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const el = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.textContent = text; svg.append(el); return el;
}
function horizontal(svg, high, baseline) {
  // Space beyond the data range keeps the entire point/mean marker visible.
  const x = value => 70 + (value / high + .04) / 1.08 * 564;
  add(svg, 'line', { x1: 70, x2: 634, y1: baseline, y2: baseline, class: 'plot-axis' });
  for (let i = 0; i <= 4; i++) {
    const value = high * i / 4;
    add(svg, 'line', { x1: x(value), x2: x(value), y1: baseline, y2: baseline + 5, class: 'plot-axis' });
    add(svg, 'text', { x: x(value), y: baseline + 27, 'text-anchor': 'middle', class: 'plot-muted' }, tick(value));
  }
  return x;
}
function meanMarker(svg, x, top, bottom) {
  add(svg, 'line', { x1: x, x2: x, y1: top, y2: bottom, stroke: '#9a472e', 'stroke-dasharray': '4 4', 'data-clt-mark': 'latest-mean' });
  add(svg, 'path', { d: `M${x},${top} l-6,8 l6,8 l6,-8 Z`, fill: '#9a472e', 'data-clt-mark': 'mean-symbol' });
}

export function drawCLTSample(svg, values, average) {
  validValues(values);
  svg.replaceChildren();
  if (!values.length) { svg.setAttribute('aria-label', '尚未抽取原始样本'); return; }
  const high = Math.max(2, ...values), x = horizontal(svg, high, 205);
  values.forEach((value, i) => {
    const circle = add(svg, 'circle', { cx: x(value), cy: 65 + i % 7 * 15, r: 4.5, fill: '#086f68', 'data-clt-observation': i + 1 });
    add(circle, 'title', {}, `Y${i + 1} = ${value}`);
  });
  meanMarker(svg, x(average), 35, 185);
  svg.setAttribute('aria-label', `本组 ${values.length} 个原始观测，绿色点按观测顺序上下错开；棕色标记是本组均值 ${number(average)}`);
}

export function drawCLTHistogram(svg, means, latestMean) {
  const plan = cltHistogram(means);
  svg.replaceChildren();
  if (!means.length) { svg.setAttribute('aria-label', '尚无重复样本均值'); return; }
  const x = horizontal(svg, plan.high, 255), y = count => 255 - count / plan.maximumCount * 210;
  add(svg, 'line', { x1: 70, x2: 70, y1: 45, y2: 255, class: 'plot-axis' });
  for (let i = 0; i <= 4; i++) {
    const count = plan.maximumCount * i / 4;
    add(svg, 'text', { x: 60, y: y(count) + 5, 'text-anchor': 'end', class: 'plot-muted' }, String(count));
  }
  plan.counts.forEach((count, i) => add(svg, 'rect', { x: x(i * plan.width) + 1, y: y(count), width: x(plan.width) - x(0) - 2, height: 255 - y(count), fill: '#b9d9cc', 'data-clt-count': count }));
  meanMarker(svg, x(latestMean), 35, 255);
  add(svg, 'text', { x: 70, y: 22, class: 'plot-label' }, '组数（频数）');
  add(svg, 'text', { x: 350, y: 312, 'text-anchor': 'middle', class: 'plot-label' }, '样本均值 ȳ');
  svg.setAttribute('aria-label', `${means.length} 个样本均值的频数直方图；每组贡献一个均值；棕色标记是最新一组的均值 ${number(latestMean)}`);
}

export function mountCLT(root) {
  if (root.dataset.cltReady) return;
  root.classList.add('clt-lab');
  root.innerHTML = `<h3>一组原始数据 → 一个均值 → 均值的抽样分布</h3>
    <p>来源始终是 Exp(rate=1)，总体 mean=1、SD=1。每组独立抽 <b>n</b> 个原始 Y，算出一个 ȳ；重复 <b>B</b> 组后得到 B 个均值。原始总体不会因为 n 增大而变正态。</p>
    <p>先点“抽 1 组”，核对原始值怎样得到一个均值；再用“重复 100 组”观察这些均值的分布。</p>
    <div class="controls"><label>每组观测数 n：<output data-clt-n-value>10</output><input id="cltn" data-clt-n type="range" min="1" max="100" step="1" value="10"></label></div>
    <div class="lab-actions"><button type="button" id="clt-one" data-clt-action="one">抽 1 组</button><button type="button" id="clt-step" data-clt-action="hundred">重复 100 组</button><button type="button" id="clt-reset" data-clt-action="reset" class="secondary">重置</button></div>
    <p class="error" data-clt-error role="alert"></p><p class="readout" id="clt-readout" data-clt-status role="status" aria-live="polite"></p>
    <p class="caption">固定 seed=440。每轮上限为 3000 组；到达上限后保留结果。改变 n 或重置会清空本轮，并从相同 seed 重新开始。</p>
    <figure class="clt-figure" data-clt-current-figure hidden><figcaption><b>① 最新一组的 n 个原始观测</b></figcaption>
      <svg data-clt-raw viewBox="0 0 680 250" role="img" aria-label="尚未抽取原始样本"></svg>
      <p class="caption">横轴是原始 Y。绿色点上下错开只为减少重叠；棕色虚线与菱形表示这一组的均值。</p><p data-clt-current></p>
    </figure>
    <details data-clt-values-details><summary>查看本组全部原始值与求平均步骤</summary><p data-clt-calculation></p><ol class="clt-values" data-clt-values></ol><p class="caption">显示值经过四舍五入；下方 R 代码保留本组完整数值。</p></details>
    <figure class="clt-figure" data-clt-means-figure hidden><figcaption><b>② 累积 B 个均值的 histogram</b></figcaption>
      <div id="clt-plot"><svg data-clt-means viewBox="0 0 680 320" role="img" aria-label="尚无重复样本均值"></svg></div>
      <p class="caption">每一组只贡献一个均值；柱高是该区间内的组数，全部柱的频数合计为 B。棕色标记定位最新一组的均值，已经包含在柱内。</p>
    </figure>
    <p class="caption clt-scale-note">两图横轴分别自动缩放，请对照刻度，不能只比较屏幕宽度。上图展示原始观测 Y，下图展示每组均值 ȳ。</p>
    <p class="readout" data-clt-statistics></p>
    <p class="caption">理论 SE=1/√n 是样本均值抽样分布的 SD；经验 SD 用 B 个均值估计它。增加 B 通常使模拟估计更稳定，不会改变固定 n 下的理论 SE；有限模拟不必恰好达到理论值。</p>
    <details><summary>用本组数据在 R 中核对</summary><button type="button" class="secondary" data-clt-copy disabled>复制本组 R 代码</button><pre data-clt-code></pre><p class="status" data-clt-copy-status role="status"></p></details>`;
  const $ = selector => root.querySelector(selector), input = $('[data-clt-n]');
  const one = $('[data-clt-action="one"]'), hundred = $('[data-clt-action="hundred"]'), copy = $('[data-clt-copy]');
  const simulation = createCLTSimulation();
  let revision = 0;
  const readN = () => validN(input.value.trim() ? Number(input.value) : NaN);
  function render(state) {
    revision++;
    $('[data-clt-error]').textContent = ''; input.setAttribute('aria-invalid', 'false');
    $('[data-clt-n-value]').textContent = state.n;
    $('[data-clt-status]').textContent = `n=${state.n} 个观测/组 · B=${state.B} 组（${state.B} 个均值） · nB=${state.total} 个原始观测。${state.added ? `本次增加 ${state.added} 组与 ${state.added} 个均值。` : ''}${state.remaining === 0 ? '已达本轮 3000 组上限，结果已保留；重置或改变 n 可开始新一轮。' : state.B === 0 ? '先抽 1 组，追踪一个均值的来源。' : ''}`;
    one.disabled = hundred.disabled = state.remaining === 0;
    hundred.textContent = state.remaining === 0 ? '已达 3000 组上限' : state.remaining < 100 ? `重复剩余 ${state.remaining} 组` : '重复 100 组';
    $('[data-clt-current-figure]').hidden = $('[data-clt-means-figure]').hidden = !state.latest;
    drawCLTSample($('[data-clt-raw]'), state.latest?.values || [], state.latest?.mean);
    drawCLTHistogram($('[data-clt-means]'), state.means, state.latest?.mean);
    $('[data-clt-current]').textContent = state.latest ? `第 ${state.B} 组：ΣY=${number(state.latest.sum)}；ȳ=ΣY/${state.n}=${number(state.latest.mean)}。这整组只向下图贡献 1 个均值。` : '';
    $('[data-clt-calculation]').textContent = state.latest ? `按以下顺序抽取 ${state.n} 个原始值，相加得到 ${number(state.latest.sum)}，再除以 ${state.n}，得到本组均值 ${number(state.latest.mean)}。` : '尚未抽取本组数据。';
    $('[data-clt-values]').innerHTML = state.latest ? state.latest.values.map((value, i) => `<li><span>Y${i + 1}</span><code>${Number(value.toPrecision(9))}</code></li>`).join('') : '';
    $('[data-clt-statistics]').textContent = `B 个均值的平均=${state.B ? number(state.meanOfMeans) : '尚未生成'} · 均值之间的经验 sample SD=${state.sdOfMeans === null ? `未定义（B=${state.B}，至少需要 2 个均值）` : number(state.sdOfMeans)} · 理论 SE=1/√${state.n}=${number(state.theoreticalSE)}。总体原始观测的 SD 始终为 1。`;
    $('[data-clt-code]').textContent = state.latest ? cltRCode(state.latest.values) : '# Draw a sample to display its R verification code.';
    copy.disabled = !state.latest; $('[data-clt-copy-status]').textContent = '';
  }
  function showError(error) {
    revision++;
    $('[data-clt-error]').textContent = error.message; input.setAttribute('aria-invalid', 'true');
    one.disabled = hundred.disabled = copy.disabled = true;
    $('[data-clt-status]').textContent = '等待有效的每组观测数 n。';
    $('[data-clt-current-figure]').hidden = $('[data-clt-means-figure]').hidden = true;
    drawCLTSample($('[data-clt-raw]'), []); drawCLTHistogram($('[data-clt-means]'), []);
    for (const key of ['current', 'calculation', 'values', 'statistics', 'code', 'copy-status', 'n-value']) $('[data-clt-' + key + ']').textContent = '';
  }
  const reset = () => { try { render(simulation.reset(readN())); } catch (error) { showError(error); } };
  const draw = count => {
    try {
      const n = readN(); if (n !== simulation.snapshot().n) simulation.reset(n);
      render(simulation.draw(count));
    } catch (error) { showError(error); }
  };
  input.addEventListener('input', reset);
  one.addEventListener('click', () => draw(1)); hundred.addEventListener('click', () => draw(100));
  $('[data-clt-action="reset"]').addEventListener('click', reset);
  copy.addEventListener('click', async () => {
    const currentRevision = revision, code = $('[data-clt-code]').textContent;
    try {
      await navigator.clipboard.writeText(code);
      if (currentRevision === revision) $('[data-clt-copy-status]').textContent = '已复制本组完整数据与 R 核对代码。';
    } catch { if (currentRevision === revision) $('[data-clt-copy-status]').textContent = '请选中上方完整代码复制。'; }
  });
  render(simulation.snapshot()); root.dataset.cltReady = 'true';
}
