const initialMeans = [10, 12, 14, 20], initialSizes = [2, 2, 2, 2];
const meanIds = ['f11', 'f21', 'f12', 'f22'], sizeIds = ['fn11', 'fn21', 'fn12', 'fn22'];
const names = ['V1 · low', 'V2 · low', 'V1 · high', 'V2 · high'];
const show = value => Number(value.toFixed(5)).toString();

// Input order follows the four original chapter controls: V1-low, V2-low,
// V1-high, V2-high. All cells exist; these are summaries, not raw observations.
export function factorialSummary({ means, sizes }) {
  if (!Array.isArray(means) || means.length !== 4 || means.some(value => !Number.isInteger(value) || value < 5 || value > 28)) throw Error('四个 cell means 必须是 5–28 的整数。');
  if (!Array.isArray(sizes) || sizes.length !== 4 || sizes.some(value => !Number.isInteger(value) || value < 1 || value > 30)) throw Error('每格 n 必须是 1–30 的整数；此演示要求四个 cells 都存在。');
  const groups = [[0, 2], [1, 3]].map((indices, i) => {
    const n = indices.map(index => sizes[index]), m = indices.map(index => means[index]), total = n[0] + n[1];
    const weights = n.map(value => value / total), rawTerms = weights.map((weight, j) => weight * m[j]), equalTerms = m.map(value => value / 2);
    return { name: `V${i + 1}`, n, means: m, total, weights, rawTerms, equalTerms, raw: rawTerms[0] + rawTerms[1], equal: equalTerms[0] + equalTerms[1] };
  });
  const simple = [means[1] - means[0], means[3] - means[2]];
  return { means: [...means], sizes: [...sizes], groups, N: sizes.reduce((a, b) => a + b, 0), simple,
    interaction: simple[1] - simple[0], equalDifference: groups[1].equal - groups[0].equal,
    rawDifference: groups[1].raw - groups[0].raw, equalFertilizer: (means[2] + means[3] - means[0] - means[1]) / 2 };
}

export function factorialRCode(settings) {
  const r = factorialSummary(settings), rowOrder = [0, 2, 1, 3];
  return `# Current cell summaries only; no individual observations are invented.
# Rows are varieties, columns are fertilizer levels.
cell_mean <- matrix(c(${rowOrder.map(i => r.means[i]).join(', ')}),nrow=2,byrow=TRUE,
                    dimnames=list(c("V1","V2"),c("low","high")))
n <- matrix(c(${rowOrder.map(i => r.sizes[i]).join(', ')}),nrow=2,byrow=TRUE,
            dimnames=dimnames(cell_mean))
observed_weights <- n/rowSums(n)
raw_mean <- rowSums(observed_weights*cell_mean)
# The chosen target gives each fertilizer condition one half of the weight.
equal_mean <- rowMeans(cell_mean)
simple_effect <- cell_mean["V2",]-cell_mean["V1",]
interaction <- unname(simple_effect["high"]-simple_effect["low"])
print(cell_mean)
print(n)
print(observed_weights)
print(data.frame(variety=rownames(n),raw=raw_mean,equal=equal_mean))
result <- c(simple_low=unname(simple_effect["low"]),
            simple_high=unname(simple_effect["high"]),interaction=interaction,
            equal_variety=unname(equal_mean["V2"]-equal_mean["V1"]),
            raw_variety=unname(raw_mean["V2"]-raw_mean["V1"]),
            equal_fertilizer=unname(diff(colMeans(cell_mean))))
print(result)
# Unequal observed weights compare different fertilizer compositions.
# Equal weighting defines a target, not a universally correct population.
# These summaries provide no within-cell error estimate: no SE, CI or P is computed.
# Changing n can change precision even when these point estimates stay fixed.`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attributes, text = '') {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
export function drawFactorial(svg, result) {
  svg.replaceChildren();
  const x = [110, 550], y = value => 260 - value / 32 * 208;
  for (const value of [0, 8, 16, 24, 32]) {
    add(svg, 'line', { x1: 76, x2: 604, y1: y(value), y2: y(value), stroke: '#ccd6cf' });
    add(svg, 'text', { x: 61, y: y(value) + 6, 'text-anchor': 'end', class: 'fact-tick' }, value);
  }
  add(svg, 'text', { x: 76, y: 28, class: 'fact-label' }, 'Cell mean response');
  for (const [i, group] of result.groups.entries()) {
    const color = i ? '#9a472e' : '#086f68';
    add(svg, 'line', { x1: x[0], x2: x[1], y1: y(group.means[0]), y2: y(group.means[1]), stroke: color, 'stroke-width': 3, 'stroke-dasharray': i ? '7 4' : '', 'data-fact-line': group.name });
    group.means.forEach((value, j) => add(svg, i ? 'rect' : 'circle', i
      ? { x: x[j] - 6, y: y(value) - 6, width: 12, height: 12, fill: color, 'data-fact-point': `${group.name}-${j}` }
      : { cx: x[j], cy: y(value), r: 6, fill: color, 'data-fact-point': `${group.name}-${j}` }));
  }
  for (const [j, label] of ['Low', 'High'].entries()) add(svg, 'text', { x: x[j], y: 300, 'text-anchor': 'middle', class: 'fact-label' }, label);
  svg.setAttribute('aria-label', `Fertilizer low 到 high；V1 为实线圆点 ${result.groups[0].means.join(' 到 ')}，V2 为虚线方点 ${result.groups[1].means.join(' 到 ')}。Simple effects 为 ${result.simple.join('、')}，interaction I=${result.interaction}。图仅使用 cell means，不使用 n，不显示 uncertainty。`);
}

export function mountFactorial(root) {
  if (root.dataset.factorialReady) return;
  root.classList.add('fact-lab');
  const controls = meanIds.map((id, i) => `<fieldset><legend>${names[i]}</legend><label for="${id}">Cell mean <output id="${id}-v" for="${id}">${initialMeans[i]}</output></label><input type="range" id="${id}" min="5" max="28" step="1" value="${initialMeans[i]}"><label for="${sizeIds[i]}">独立实验单位数 n</label><input type="number" id="${sizeIds[i]}" min="1" max="30" step="1" value="2" inputmode="numeric"></fieldset>`).join('');
  const bars = [0, 1].map(i => ['raw', 'equal'].map(method => `<div class="fact-contribution"><b>V${i + 1} · ${method === 'raw' ? 'observed weights' : 'equal weights'}</b><div class="fact-bar-track" role="img" data-fact-bar="${i}-${method}"><span class="fact-bar-low" data-fact-term="${i}-${method}-0"></span><span class="fact-bar-high" data-fact-term="${i}-${method}-1"></span></div><p data-fact-formula="${i}-${method}"></p></div>`).join('')).join('');
  root.innerHTML = `<p>先调整四个 cell means，观察 simple effects。再载入不平衡例，只改变 V1 的样本构成：线条和条件效应不变，raw marginal mean 是否改变？</p>
    <div class="fact-controls">${controls}</div>
    <div class="fact-actions"><button type="button" data-fact-action="example">载入本文不平衡例</button><button type="button" class="secondary" data-fact-action="reverse">反转 V1 low / high 样本数</button><button type="button" class="secondary" data-fact-action="reset">恢复初始</button></div>
    <p class="fact-error" data-fact-error role="alert"></p><p class="fact-note" data-fact-operation role="status"></p>
    <div data-fact-results>
      <figure><figcaption><b>① 条件关系：只由四个 cell means 决定</b></figcaption><p class="fact-legend">V1：绿色实线 / 圆点；V2：棕色虚线 / 方点。</p><svg data-fact-plot viewBox="0 0 680 325" role="img"></svg><p class="fact-note">仅改变 n 时，图形、simple effects 与 I 都保持不变。图未显示 uncertainty；样本数变化仍可能改变估计精度。不平行不自动意味着统计显著。</p></figure>
      <div class="fact-readout" data-fact-readout aria-live="polite"></div>
      <h3>② 对哪一种肥料构成取平均？</h3><p><b>Raw mean</b> 用各品种实际观测比例。<b>Equal-cell mean</b> 指定 low / high 各占一半；这是一种目标，并不是唯一自然正确的权重。</p>
      <p data-fact-weights></p>
      <div class="fact-legend"><span>绿色实色：low 的贡献</span><span>棕色斜纹：high 的贡献</span></div>
      <p class="fact-note">每段长度 = weight × cell mean，整条长度 = 对应 marginal mean。四条使用同一 0–28 尺度；这里的均值限定为正数，段可直接相加。显示数值经过四舍五入，计算使用完整权重；公式保留 n / 组内总数的分数形式。</p>
      <div class="fact-contributions">${bars}</div><p class="fact-note">不同品种的 observed weights 可能不同；raw 差因此不能直接当成同一权重下的平均 simple effect。等权 variety 差 = (low simple effect + high simple effect) / 2。平均差也可能掩盖相反方向的条件效应。</p>
    </div>
    <details><summary>复制当前汇总到 base R 核对</summary><button type="button" class="secondary" data-fact-copy disabled>复制当前 R 代码</button><pre data-fact-code></pre><p class="fact-note" data-fact-copy-status role="status"></p></details>
    <p class="fact-note">这里编辑假设的完整四格汇总，不把同一单位复制多次充当独立重复。仅有 n 与 cell means 无法估计 cell 内误差，因此不计算 SE、CI 或 P。若有空 cell，某些目标可能不可估计，超出本演示范围。<a href="#unbalanced">回到权重与 LSMeans 讲解</a>。</p>`;
  const $ = selector => root.querySelector(selector), fields = [...meanIds, ...sizeIds].map(id => $(`#${id}`));
  const graph = $('[data-fact-plot]'), copy = $('[data-fact-copy]');
  let revision = 0, result = null;
  const read = () => factorialSummary({ means: meanIds.map(id => Number($(`#${id}`).value)), sizes: sizeIds.map(id => Number($(`#${id}`).value)) });
  function update() {
    revision++; $('[data-fact-copy-status]').textContent = '';
    meanIds.forEach(id => $(`#${id}-v`).textContent = $(`#${id}`).value);
    try {
      result = read(); $('[data-fact-error]').textContent = ''; $('[data-fact-results]').hidden = false;
      fields.forEach(field => field.setAttribute('aria-invalid', 'false'));
      drawFactorial(graph, result);
      $('[data-fact-readout]').textContent = `V2−V1：low simple effect=${show(result.simple[0])}；high simple effect=${show(result.simple[1])}；I=high−low=${show(result.interaction)}。等权 variety 差=${show(result.equalDifference)}；raw variety 差=${show(result.rawDifference)}。等权 fertilizer 差（high−low）=${show(result.equalFertilizer)}。总 N=${result.N}。`;
      $('[data-fact-weights]').textContent = result.groups.map(group => `${group.name}：n(low,high)=(${group.n.join(',')})；observed weights=(${group.n.map(n => `${n}/${group.total}`).join(',')})；equal weights=(1/2,1/2)`).join('。') + '。';
      result.groups.forEach((group, i) => {
        for (const method of ['raw', 'equal']) {
          const weights = method === 'raw' ? group.n.map(n => `${n}/${group.total}`) : ['1/2', '1/2'], terms = method === 'raw' ? group.rawTerms : group.equalTerms;
          const relation = Number(show(group[method])) === group[method] ? '=' : '≈';
          const formula = `${weights.map((weight, j) => `${weight} × ${group.means[j]}`).join(' + ')} ${relation} ${show(group[method])}`;
          $(`[data-fact-formula="${i}-${method}"]`).textContent = formula;
          $(`[data-fact-bar="${i}-${method}"]`).setAttribute('aria-label', `${group.name} ${method}: ${formula}；共同 0–28 尺度。`);
          terms.forEach((term, j) => { const span = $(`[data-fact-term="${i}-${method}-${j}"]`); span.style.width = `${term / 28 * 100}%`; span.setAttribute('title', `${j ? 'high' : 'low'}: ${show(term)}`); });
        }
      });
      $('[data-fact-code]').textContent = factorialRCode(result); copy.disabled = false;
    } catch (error) {
      result = null; $('[data-fact-error]').textContent = error.message; $('[data-fact-results]').hidden = true;
      fields.forEach(field => field.setAttribute('aria-invalid', 'true'));
      graph.replaceChildren(); graph.setAttribute('aria-label', '等待有效的四格汇总');
      $('[data-fact-code]').textContent = ''; copy.disabled = true;
    }
  }
  const assign = (means, sizes) => { meanIds.forEach((id, i) => $(`#${id}`).value = String(means[i])); sizeIds.forEach((id, i) => $(`#${id}`).value = String(sizes[i])); update(); };
  fields.forEach(field => field.addEventListener('input', () => { $('[data-fact-operation]').textContent = '当前为手动编辑的四格汇总。'; update(); }));
  $('[data-fact-action="example"]').addEventListener('click', () => { $('[data-fact-operation]').textContent = '已载入本文例：V1 的 low/high 为 9/1，V2 为 2/2。先读 raw 差，再反转 V1 样本数。'; assign([10, 12, 20, 18], [9, 2, 1, 2]); });
  $('[data-fact-action="reset"]').addEventListener('click', () => { $('[data-fact-operation]').textContent = '已恢复初始 cell means 与每格 n=2。'; assign(initialMeans, initialSizes); });
  $('[data-fact-action="reverse"]').addEventListener('click', () => {
    try { const current = read(), sizes = [...current.sizes]; [sizes[0], sizes[2]] = [sizes[2], sizes[0]]; $('[data-fact-operation]').textContent = '仅交换 V1 的 low/high 样本数；cell means 和四格是否存在均未改变。'; assign(current.means, sizes); }
    catch (error) { $('[data-fact-error]').textContent = error.message + ' 本次操作未改变输入。'; }
  });
  copy.addEventListener('click', async () => {
    if (!result) return;
    const version = revision, code = $('[data-fact-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-fact-copy-status]').textContent = '已复制当前 cell means、样本数与权重计算。'; }
    catch { if (version === revision) $('[data-fact-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; }
  });
  update(); root.dataset.factorialReady = 'true';
}
