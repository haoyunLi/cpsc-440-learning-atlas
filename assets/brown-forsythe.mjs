import { fSurvival } from './math.mjs';
import { parseSample } from './sample.mjs';

const sum = values => values.reduce((total, value) => total + value, 0);
const show = value => Number.isFinite(value) ? Number(value.toPrecision(8)).toString() : '无法计算';
const validate = values => {
  if (!Array.isArray(values) || values.length < 2 || values.length > 50 || values.some(value => !Number.isFinite(value) || Math.abs(value) > 1e6)) throw Error('每组请输入 2–50 个有限观测，绝对值不超过 1e6。');
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.some((value, i) => (value !== 0 && Math.abs(value) < 1e-300) || (i > 0 && value !== sorted[i - 1] && value - sorted[i - 1] < 1e-300))) {
    throw Error('数值过于接近浮点精度下限：非零观测的绝对值及非零组内差异须至少为 1e-300；请换用更大的计量单位后重试。');
  }
};
const median = values => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] + (sorted[middle] - sorted[middle - 1]) / 2;
};
function quadraticText(scaled, scale) {
  if (scaled === 0) return '0';
  const value = scaled * scale * scale;
  if (value > 0 && Number.isFinite(value)) return show(value);
  const log = Math.log10(scaled) + 2 * Math.log10(scale), exponent = Math.floor(log);
  return `${show(10 ** (log - exponent))}e${exponent}`;
}

export function parseBFGroup(raw) {
  try { const values = parseSample(raw); validate(values); return values; }
  catch (error) { throw Error(error.message.replace('2–500', '2–50')); }
}

export function brownForsythe(a, b) {
  validate(a); validate(b);
  const input = [a, b], medians = input.map(median);
  const groups = input.map((values, group) => values.map((y, index) => ({ id: `${group ? 'B' : 'A'}${index + 1}`, group, index,
    y, median: medians[group], deviation: y - medians[group], z: Math.abs(y - medians[group]) })));
  const rows = groups.flat(), scale = Math.max(...rows.map(row => row.z));
  // F is unchanged by a common positive scaling of Z. Normalizing before
  // squaring preserves the ratio even when SS in the original units underflows.
  const normalized = groups.map(group => group.map(row => scale ? row.z / scale : 0));
  const centers = normalized.map(values => sum(values) / values.length), N = rows.length, dfBetween = 1, dfWithin = N - 2;
  const grand = sum(centers.map((center, group) => center * input[group].length)) / N;
  const ssBetweenScaled = sum(centers.map((center, group) => input[group].length * (center - grand) ** 2));
  const ssWithinScaled = sum(normalized.map((values, group) => sum(values.map(value => (value - centers[group]) ** 2))));
  const msBetweenScaled = ssBetweenScaled, msWithinScaled = ssWithinScaled / dfWithin;
  const estimable = scale > 0 && Math.sqrt(msWithinScaled) > 32 * Number.EPSILON;
  const f = estimable ? msBetweenScaled / msWithinScaled : null, p = estimable ? fSurvival(f, dfBetween, dfWithin) : null;
  const reason = estimable ? '' : scale === 0
    ? '所有 Z 都为 0：各组观测都等于本组中位数，MSE=0，常规 F 比及 P 值未定义。'
    : 'Z 的组内变异为 0 或接近当前数值精度，无法稳定估计误差 MSE；这里不报告常规 F 或 P。每组只有两个值时，两者到中位数的距离常相同。';
  return { groups, rows, medians, sizes: input.map(values => values.length), N, scale,
    zMeans: centers.map(center => center * scale), grandZ: grand * scale,
    dfBetween, dfWithin, ssBetweenScaled, ssWithinScaled, msBetweenScaled, msWithinScaled,
    ssBetween: ssBetweenScaled * scale * scale, ssWithin: ssWithinScaled * scale * scale,
    mse: msWithinScaled * scale * scale, f, p, estimable, reason,
    text: { between: quadraticText(ssBetweenScaled, scale), within: quadraticText(ssWithinScaled, scale),
      total: quadraticText(ssBetweenScaled + ssWithinScaled, scale), mse: quadraticText(msWithinScaled, scale) } };
}

export function transformBFGroup(values, operation) {
  validate(values);
  if (!['shift', 'spread'].includes(operation)) throw Error('未知的数据操作。');
  const center = median(values), changed = values.map(value => operation === 'shift' ? value + 100 : center + 2 * (value - center));
  validate(changed);
  const range = Math.max(...values) - Math.min(...values), factor = operation === 'shift' ? 1 : 2;
  if (range > 0) {
    const newCenter = median(changed);
    if (changed.some((value, i) => Math.abs((value - newCenter) / range - factor * ((values[i] - center) / range)) > 1e-8)) {
      throw Error('当前浮点精度无法保持本次变换的组内差异；请改用能分辨这些差异的计量单位。');
    }
  }
  return changed;
}

export function bfAxis(values) {
  if (!values.length || values.some(value => !Number.isFinite(value))) throw Error('绘图需要有限数值。');
  const min = Math.min(...values), max = Math.max(...values), range = max - min;
  const span = range || Math.max(Math.abs(min) * .2, min === 0 ? 2 : Number.MIN_VALUE), shift = range ? 0 : .5;
  const offset = Math.abs(min) / span >= 10 ? min : 0;
  const magnitude = Math.max(Math.abs(min - offset + (-.08 - shift) * span), Math.abs(min - offset + (1.08 - shift) * span));
  const exponent = magnitude >= 1e4 || magnitude < .1 ? Math.max(-323, Math.floor(Math.log10(magnitude))) : 0;
  const unit = 10 ** exponent, base = (min - offset) / unit, scaledSpan = span / unit, step = scaledSpan * 1.16 / 4;
  const decimals = Math.max(0, 1 - Math.floor(Math.log10(step)));
  const ticks = Array.from({ length: 5 }, (_, i) => ({ x: 76 + 548 * i / 4,
    label: String(Number((base + (i * 1.16 / 4 - .08 - shift) * scaledSpan).toFixed(decimals))) }));
  const note = offset || exponent ? `实际值 = ${offset ? `${String(offset)} + ` : ''}刻度${exponent ? ` × 1e${exponent}` : ''}。` : '横轴使用原始单位。';
  return { ticks, position: value => 76 + ((value - min) / span + shift + .08) / 1.16 * 548,
    note: note + (range ? '' : '所有位置相同；坐标留白不代表存在变异。') };
}

export function brownForsytheRCode(a, b) {
  brownForsythe(a, b);
  return `# Current observations; none are discarded.
a <- c(${a.join(', ')})
b <- c(${b.join(', ')})
d <- data.frame(group=factor(rep(c("A","B"),c(length(a),length(b)))),
                y=c(a,b))
d$group_median <- ave(d$y,d$group,FUN=median)
d$z <- abs(d$y-d$group_median)
print(d)
print(aggregate(z~group,data=d,FUN=mean))
# A common positive scaling prevents underflow when squared deviations are tiny.
z_scale <- max(d$z)
available <- FALSE
f_value <- p_value <- NA_real_
if (z_scale == 0) {
  message("All absolute deviations are zero: ordinary F inference is undefined.")
} else {
  d$z_scaled <- d$z/z_scale
  within <- d$z_scaled-ave(d$z_scaled,d$group,FUN=mean)
  mse_scaled <- sum(within^2)/(nrow(d)-2)
  if (sqrt(mse_scaled) <= 32*.Machine$double.eps) {
    message("No numerically usable within-group variation in Z; F and P omitted.")
  } else {
    fit <- aov(z_scaled~group,data=d)
    tab <- summary(fit)[[1]]
    f_value <- tab[1,"F value"]
    p_value <- tab[1,"Pr(>F)"]
    available <- TRUE
    original <- as.matrix(tab[,c("Sum Sq","Mean Sq")])*z_scale^2
    positive <- as.matrix(tab[,c("Sum Sq","Mean Sq")]) > 0
    if (all(is.finite(original)) && all(original[positive] > 0)) {
      tab[,c("Sum Sq","Mean Sq")] <- original
      print(tab)
    } else {
      print(tab)
      message("SS and MS above use Z/z_scale units; F and P are scale invariant.")
      print(c(log10_original_SS_multiplier=2*log10(z_scale)))
    }
  }
}
print(c(available=available,F=f_value,P=p_value))
# This is the median-centered Levene/Brown-Forsythe dispersion test.
# Its F reference is approximate. Independent units and appropriate sampling
# remain necessary; arbitrary distributional shapes need not differ only in variance.`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const el = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.textContent = text; svg.append(el); return el;
}
export function drawBrownForsythe(svg, result, kind, selectedId) {
  if (!['raw', 'z'].includes(kind)) throw Error('未知图形。');
  const raw = kind === 'raw', values = result.rows.map(row => raw ? row.y : row.z), axis = bfAxis(raw ? values : [0, ...values]);
  svg.replaceChildren();
  add(svg, 'line', { x1: 76, x2: 624, y1: 220, y2: 220, class: 'bf-axis' });
  for (const item of axis.ticks) add(svg, 'text', { x: item.x, y: 247, 'text-anchor': 'middle', class: 'bf-tick' }, item.label);
  const selected = result.rows.find(row => row.id === selectedId);
  if (selected) {
    const y = (selected.group ? 160 : 80) + (selected.index % 5 - 2) * 7;
    add(svg, 'line', { x1: axis.position(raw ? selected.median : 0), x2: axis.position(raw ? selected.y : selected.z), y1: y, y2: y, stroke: '#9a472e', 'stroke-width': 3, 'data-bf-distance': selected.id });
  }
  for (let group = 0; group < 2; group++) {
    const center = group ? 160 : 80, marker = raw ? result.medians[group] : result.zMeans[group];
    add(svg, 'text', { x: 30, y: center + 5, class: 'bf-label' }, group ? 'B' : 'A');
    add(svg, 'line', { x1: axis.position(marker), x2: axis.position(marker), y1: center - 30, y2: center + 30,
      stroke: '#183a37', 'stroke-dasharray': raw ? '5 4' : '2 3', 'data-bf-center': group ? 'B' : 'A' });
  }
  for (const row of result.rows) {
    const x = axis.position(raw ? row.y : row.z), y = (row.group ? 160 : 80) + (row.index % 5 - 2) * 7, selected = row.id === selectedId;
    const size = selected ? 6 : 4.5, attrs = { fill: row.group ? '#9a472e' : '#086f68', stroke: selected ? '#183a37' : 'white', 'stroke-width': selected ? 3 : 1, 'data-bf-point': row.id };
    const point = add(svg, row.group ? 'rect' : 'circle', row.group ? { ...attrs, x: x - size, y: y - size, width: 2 * size, height: 2 * size } : { ...attrs, cx: x, cy: y, r: size });
    add(point, 'title', {}, `${row.id}: ${raw ? 'Y' : 'Z'}=${show(raw ? row.y : row.z)}`);
  }
  svg.setAttribute('aria-label', `${raw ? '原始值及每组中位数' : '到本组中位数的绝对距离Z及各组平均距离'}；A为圆点，B为方点；加粗点是${selectedId}。${axis.note}`);
  return axis.note;
}

export function mountBrownForsythe(root) {
  if (root.dataset.bfReady) return;
  root.classList.add('bf-lab');
  root.innerHTML = `<h3>动手把“分散”变成绝对距离</h3><p>先保持 A 不变，给 B 整组加 100；再恢复示例，围绕 B 的中位数放大两倍。预测：哪一种操作改变 Z，以及比较 Z 的 ANOVA？按钮作用于当前输入，可重复点击。</p>
    <div class="bf-controls"><label>A 组：2–50 个独立观测<textarea data-bf-input="a">2, 3, 4</textarea></label><label>B 组：2–50 个独立观测<textarea data-bf-input="b">1, 3, 5</textarea></label></div>
    <p class="bf-note">数值范围：绝对值 ≤1e6；非零观测的绝对值及非零组内差异至少为 1e-300。超出精度范围时请更换计量单位。</p>
    <div class="bf-actions"><button type="button" data-bf-action="shift">B 整组 +100</button><button type="button" data-bf-action="spread">B 围绕 median ×2</button><button type="button" class="secondary" data-bf-action="reset">恢复例子</button></div>
    <p class="bf-error" data-bf-error role="alert"></p><p class="bf-note" data-bf-operation role="status"></p>
    <div data-bf-results><div class="bf-readout" data-bf-summary aria-live="polite"></div>
    <figure><figcaption><b>① 原始 Y：虚线是本组 median</b></figcaption><svg data-bf-plot="raw" viewBox="0 0 680 275" role="img"></svg><p class="bf-note" data-bf-axis="raw"></p></figure>
    <figure><figcaption><b>② Z=|Y−median|：点线是该组 Z 的平均</b></figcaption><svg data-bf-plot="z" viewBox="0 0 680 275" role="img"></svg><p class="bf-note" data-bf-axis="z"></p></figure>
    <p class="bf-note">A 用圆点，B 用方点；上下错开只为减少重叠。两图分别缩放，须对照横轴刻度。下表的“追踪”按钮同时标出同一观测及其距离。</p>
    <p class="bf-trace" data-bf-trace aria-live="polite"></p>
    <div class="bf-table-wrap" tabindex="0" role="region" aria-label="原始值到绝对偏差的逐行表，可滚动"><table><caption>每个观测完整保留；显示数值经过四舍五入</caption><thead><tr><th scope="col">追踪观测</th><th scope="col">原始 Y</th><th scope="col">本组 median</th><th scope="col">Y−median</th><th scope="col">Z=|Y−median|</th></tr></thead><tbody data-bf-rows></tbody></table></div>
    <h4>③ 对 Z 做 one-way ANOVA</h4><div class="bf-table-wrap" tabindex="0" role="region" aria-label="绝对偏差ANOVA表，可横向滚动"><table><thead><tr><th scope="col">来源</th><th scope="col">df</th><th scope="col">SS</th><th scope="col">MS</th><th scope="col">F</th><th scope="col">P（近似）</th></tr></thead><tbody data-bf-anova></tbody></table></div><p data-bf-conclusion></p></div>
    <details><summary>在 R 中核对当前两组数据</summary><button type="button" class="secondary" data-bf-copy disabled>复制当前 R 代码</button><pre data-bf-code></pre><p class="bf-note" data-bf-copy-status role="status"></p></details>
    <p class="bf-note">这是 median-centered Levene / Brown–Forsythe 检验，F reference 是近似。它不把两组正态或方差相等作为硬性前提；仍需组间与组内的独立实验单位、适当抽样和足够信息。Z 的均值直接刻画离本组中心的平均距离；在任意不同分布形状下，不能把它宣称为只检验 variance 的精确方法。未拒绝不证明等方差；不要先按此 P 值机械选择 pooled 或 Welch。</p>
    <p><a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda35a.htm" target="_blank" rel="noopener noreferrer">NIST：Levene 检验及 median-centered 变体</a></p>`;
  const $ = selector => root.querySelector(selector), inputA = $('[data-bf-input="a"]'), inputB = $('[data-bf-input="b"]');
  const tbody = $('[data-bf-rows]'), copy = $('[data-bf-copy]');
  let result = null, selected = 'A1', revision = 0, rowOrder = [];
  const tableRows = new Map();
  function selection() {
    if (!result) return;
    const row = result.rows.find(row => row.id === selected);
    for (const [id, record] of tableRows) { record.button.setAttribute('aria-pressed', String(id === selected)); record.tr.setAttribute('data-selected', String(id === selected)); }
    $('[data-bf-trace]').textContent = `追踪 ${row.id}：Y=${show(row.y)}，本组 median=${show(row.median)}；Y−median=${show(row.deviation)}，取绝对值得 Z=${show(row.z)}。`;
    for (const kind of ['raw', 'z']) $('[data-bf-axis="' + kind + '"]').textContent = drawBrownForsythe($('[data-bf-plot="' + kind + '"]'), result, kind, selected);
  }
  function rows() {
    const ids = result.rows.map(row => row.id);
    for (const row of result.rows) {
      if (!tableRows.has(row.id)) {
        const tr = document.createElement('tr'), first = document.createElement('td'), button = document.createElement('button');
        button.type = 'button'; button.className = 'bf-row-button'; button.textContent = `追踪 ${row.id}`;
        button.addEventListener('click', () => { selected = row.id; selection(); }); first.append(button); tr.append(first);
        const cells = Array.from({ length: 4 }, () => { const cell = document.createElement('td'); tr.append(cell); return cell; });
        tableRows.set(row.id, { tr, button, cells });
      }
      const record = tableRows.get(row.id); record.button.disabled = false;
      [row.y, row.median, row.deviation, row.z].forEach((value, i) => record.cells[i].textContent = show(value));
    }
    // Stable identities keep focused trace buttons and the table scroll intact.
    if (ids.join('|') !== rowOrder.join('|')) {
      const active = document.activeElement;
      tbody.replaceChildren(...ids.map(id => tableRows.get(id).tr));
      if ([...tableRows.values()].some(record => record.button === active && ids.includes(record.button.textContent.replace('追踪 ', '')))) active.focus({ preventScroll: true });
      rowOrder = ids;
    }
  }
  function update() {
    revision++; $('[data-bf-copy-status]').textContent = '';
    try {
      const a = parseBFGroup(inputA.value), b = parseBFGroup(inputB.value); result = brownForsythe(a, b);
      if (!result.rows.some(row => row.id === selected)) selected = 'A1';
      $('[data-bf-error]').textContent = ''; $('[data-bf-results]').hidden = false;
      inputA.setAttribute('aria-invalid', 'false'); inputB.setAttribute('aria-invalid', 'false');
      $('[data-bf-summary]').textContent = `A：n=${a.length}，median=${show(result.medians[0])}，平均 Z=${show(result.zMeans[0])}；B：n=${b.length}，median=${show(result.medians[1])}，平均 Z=${show(result.zMeans[1])}。比较的是平均绝对偏差，不是原始 Y 的均值。`;
      rows(); selection();
      const p = result.p === 0 && result.estimable ? '正概率，数值下溢' : result.estimable ? show(result.p) : '未定义';
      $('[data-bf-anova]').innerHTML = `<tr><th scope="row">Z 的组间</th><td>1</td><td>${result.text.between}</td><td>${result.text.between}</td><td>${result.estimable ? show(result.f) : '未定义'}</td><td>${p}</td></tr><tr><th scope="row">Z 的组内</th><td>${result.dfWithin}</td><td>${result.text.within}</td><td>${result.text.mse}</td><td>—</td><td>—</td></tr><tr><th scope="row">总计</th><td>${result.N - 1}</td><td>${result.text.total}</td><td>—</td><td>—</td><td>—</td></tr>`;
      $('[data-bf-conclusion]').textContent = result.estimable
        ? `在条件适用时，用 F(1,${result.dfWithin}) 作近似参考。α=.05：${result.p <= .05 ? '有证据表明平均绝对偏差不同' : '证据不足以认定平均绝对偏差不同'}。这不是原始均值检验，也不证明总体方差相同。`
        : result.reason;
      $('[data-bf-code]').textContent = brownForsytheRCode(a, b); copy.disabled = false;
    } catch (error) {
      result = null; $('[data-bf-error]').textContent = error.message; $('[data-bf-results]').hidden = true;
      inputA.setAttribute('aria-invalid', 'true'); inputB.setAttribute('aria-invalid', 'true');
      for (const kind of ['raw', 'z']) { const svg = $('[data-bf-plot="' + kind + '"]'); svg.replaceChildren(); svg.setAttribute('aria-label', '等待有效数据'); }
      for (const record of tableRows.values()) record.button.disabled = true;
      $('[data-bf-code]').textContent = ''; copy.disabled = true;
    }
  }
  for (const input of [inputA, inputB]) input.addEventListener('input', () => { $('[data-bf-operation]').textContent = '当前为手动编辑的数据。'; update(); });
  for (const operation of ['shift', 'spread']) $('[data-bf-action="' + operation + '"]').addEventListener('click', () => {
    try {
      const a = parseBFGroup(inputA.value), b = transformBFGroup(parseBFGroup(inputB.value), operation); brownForsythe(a, b);
      inputB.value = b.join(', '); $('[data-bf-operation]').textContent = operation === 'shift' ? '已将当前 B 的每个值加 100；观察 B 的 median 和原始点一起移动，而 Z 保持不变。' : '已把当前 B 到本组 median 的带符号偏差乘以 2；median 保持，绝对距离 Z 随之放大。'; update();
    } catch (error) { $('[data-bf-error]').textContent = error.message + ' 本次操作未改变输入。'; }
  });
  $('[data-bf-action="reset"]').addEventListener('click', () => { inputA.value = '2, 3, 4'; inputB.value = '1, 3, 5'; selected = 'A1'; $('[data-bf-operation]').textContent = '已恢复原创示例。'; update(); });
  copy.addEventListener('click', async () => {
    const version = revision, code = $('[data-bf-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-bf-copy-status]').textContent = '已复制当前完整观测与 R 检查代码。'; }
    catch { if (version === revision) $('[data-bf-copy-status]').textContent = '请选中上方完整代码复制。'; }
  });
  update(); root.dataset.bfReady = 'true';
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-brown-forsythe]').forEach(mountBrownForsythe);
