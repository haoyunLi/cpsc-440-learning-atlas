import { regression } from './math.mjs';

const fixedX = [0, 1, 2, 3, 4], fixedY = [1, 2, 5, 8, 9];
const presets = { online: { x: 10, y: 22.6 }, offline: { x: 10, y: 5 }, residual: { x: 2, y: 20 } };
const bounds = { x: [-4, 14], y: [-10, 40] };
const display = value => value === 0 ? '0' : Math.abs(value) < .0001 ? value.toExponential(3) : Number(value.toPrecision(7)).toString();
function validateValue(value, kind) {
  const limit = bounds[kind];
  if (!limit || !Number.isFinite(value) || value < limit[0] || value > limit[1] || (value !== 0 && Math.round(value * 10) === 0) || Math.abs(value * 10 - Math.round(value * 10)) > 16 * Number.EPSILON * Math.max(1, Math.abs(value * 10))) throw Error(`${kind} 须在 ${limit?.[0]} 到 ${limit?.[1]} 之间，以 0.1 为步长。`);
  return Math.round(value * 10) / 10;
}
export function parseInfluenceValue(raw, kind) {
  const text = String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw Error(`${kind} 请输入有限数字；空值不能当成 0。`);
  if (Number(text) === 0 && /[1-9]/.test(text.split(/[eE]/)[0])) throw Error(`${kind} 的非零输入超出浮点精度，不能当成 0；请使用 0.1 步长范围内的数值。`);
  return validateValue(Number(text), kind);
}

export function influenceAnalysis({ x, y, selected = 5 }) {
  x = validateValue(x, 'x'); y = validateValue(y, 'y');
  if (!Number.isInteger(selected) || selected < 0 || selected > 5) throw Error('请选择 P1–P6 中的一个点。');
  const xs = [...fixedX, x], ys = [...fixedY, y], full = regression(xs, ys);
  const remainingX = xs.filter((_, i) => i !== selected), without = regression(remainingX, ys.filter((_, i) => i !== selected));
  const remainingRange = [Math.min(...remainingX), Math.max(...remainingX)];
  const selectedExtrapolation = xs[selected] < remainingRange[0] || xs[selected] > remainingRange[1];
  const rows = xs.map((xi, i) => {
    const fitted = full.pred[i], residual = ys[i] - fitted, leverage = 1 / 6 + (xi - full.xb) ** 2 / full.sxx;
    const cook = residual ** 2 / (2 * full.mse) * leverage / (1 - leverage) ** 2;
    const sensitivityFitted = without.intercept + without.slope * xi;
    return { id: `P${i + 1}`, index: i, x: xi, y: ys[i], fitted, residual, leverage, cook, sensitivityFitted };
  });
  return { x, y, selected, rows, full, without, remainingRange, selectedExtrapolation, sumLeverage: rows.reduce((sum, row) => sum + row.leverage, 0),
    coefficientChange: { intercept: without.intercept - full.intercept, slope: without.slope - full.slope },
    selectedCookFromPredictions: rows.reduce((sum, row) => sum + (row.fitted - row.sensitivityFitted) ** 2, 0) / (2 * full.mse) };
}

// Both lines use one fixed viewport. Clipping restricts only the drawn line
// segments, never predictions, residuals or diagnostic calculations.
export function influenceGeometry(result) {
  const domain = { x: [-5, 15], y: [-12, 42] }, frame = { left: 76, right: 620, top: 45, bottom: 310 };
  const x = value => frame.left + (value - domain.x[0]) / 20 * (frame.right - frame.left);
  const y = value => frame.bottom - (value - domain.y[0]) / 54 * (frame.bottom - frame.top);
  const line = fit => {
    let low = domain.x[0], high = domain.x[1];
    if (fit.slope !== 0) {
      const hits = domain.y.map(value => (value - fit.intercept) / fit.slope).sort((a, b) => a - b);
      low = Math.max(low, hits[0]); high = Math.min(high, hits[1]);
    }
    if (low > high || (fit.slope === 0 && (fit.intercept < domain.y[0] || fit.intercept > domain.y[1]))) return null;
    const fitted = value => fit.intercept + fit.slope * value;
    return { x1: x(low), y1: y(Math.max(domain.y[0], Math.min(domain.y[1], fitted(low)))), x2: x(high), y2: y(Math.max(domain.y[0], Math.min(domain.y[1], fitted(high)))) };
  };
  return { domain, frame, x, y, fullLine: line(result.full), sensitivityLine: line(result.without),
    points: result.rows.map(row => ({ id: row.id, x: x(row.x), y: y(row.y), fittedY: y(row.fitted) })) };
}

export function influenceRCode(settings) {
  const result = influenceAnalysis(settings);
  return `# Original five points plus the current sixth experimental unit.
d <- data.frame(id=paste0("P",1:6),x=c(0,1,2,3,4,${result.x}),
                y=c(1,2,5,8,9,${result.y}))
selected <- ${result.selected + 1}
full <- lm(y~x,data=d)
# Sensitivity comparison only: the original data frame still has all six rows.
without_selected <- lm(y~x,data=d[-selected,])
mse <- deviance(full)/df.residual(full)
h <- hatvalues(full)
e <- residuals(full)
cook_formula <- e^2/(2*mse)*h/(1-h)^2
diagnostics <- data.frame(d,fitted=fitted(full),residual=e,
                          leverage=h,Cook=cooks.distance(full),
                          Cook_formula=cook_formula)
print(diagnostics,digits=10)
print(rbind(full=coef(full),without_selected=coef(without_selected)))
print(c(MSE_full=mse,error_df_full=df.residual(full),sum_leverage=sum(h)))
# Compare both fits at ALL SIX original x values, including the omitted unit.
full_predictions <- predict(full,newdata=d)
sensitivity_predictions <- predict(without_selected,newdata=d)
remaining_x_range <- range(d$x[-selected])
selected_extrapolation <- d$x[selected]<remaining_x_range[1] ||
                          d$x[selected]>remaining_x_range[2]
print(c(remaining_x_range=remaining_x_range,
        selected_point_is_extrapolation=selected_extrapolation))
# An omitted point outside this range is an extrapolation of the sensitivity
# line. It is used for diagnostics, not a validated prediction for a new unit.
cook_from_predictions <- sum((full_predictions-sensitivity_predictions)^2)/(2*mse)
print(data.frame(id=d$id,full=full_predictions,sensitivity=sensitivity_predictions))
print(c(selected=selected,Cook=cooks.distance(full)[selected],
        Cook_from_prediction_changes=cook_from_predictions))
stopifnot(abs(sum(h)-2)<1e-10,
          max(abs(cook_formula-cooks.distance(full)))<1e-10,
          abs(cook_from_predictions-cooks.distance(full)[selected])<1e-10)
# A large diagnostic is a reason to investigate, not an automatic deletion rule.
# Leverage depends on x, whereas residuals and Cook's distance also depend on y.
# Small nonzero values near exact zero can reflect floating-point roundoff.
# These synthetic observations do not establish a causal effect.`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
export function drawInfluence(svg, result) {
  const g = influenceGeometry(result); svg.replaceChildren();
  for (const value of [-10, 0, 10, 20, 30, 40]) {
    add(svg, 'line', { x1: g.frame.left, x2: g.frame.right, y1: g.y(value), y2: g.y(value), stroke: '#ccd6cf' });
    add(svg, 'text', { x: 62, y: g.y(value) + 6, 'text-anchor': 'end', class: 'infl-tick' }, value);
  }
  add(svg, 'line', { x1: g.frame.left, x2: g.frame.right, y1: g.frame.bottom, y2: g.frame.bottom, stroke: '#50655f' });
  for (const value of [-4, 0, 4, 8, 12]) add(svg, 'text', { x: g.x(value), y: 340, 'text-anchor': 'middle', class: 'infl-tick' }, value);
  add(svg, 'text', { x: 76, y: 26, class: 'infl-label' }, 'Response y');
  add(svg, 'text', { x: 620, y: 370, 'text-anchor': 'end', class: 'infl-label' }, 'x');
  for (const point of g.points) add(svg, 'line', { x1: point.x, x2: point.x, y1: point.y, y2: point.fittedY, stroke: point.id === `P${result.selected + 1}` ? '#9a472e' : '#668078', 'stroke-width': point.id === `P${result.selected + 1}` ? 2.5 : 1.3, 'stroke-dasharray': '3 3', 'data-infl-residual': point.id });
  if (g.fullLine) add(svg, 'line', { ...g.fullLine, stroke: '#086f68', 'stroke-width': 3, 'data-infl-line': 'full' });
  if (g.sensitivityLine) add(svg, 'line', { ...g.sensitivityLine, stroke: '#9a472e', 'stroke-width': 3, 'stroke-dasharray': '8 5', 'data-infl-line': 'sensitivity' });
  for (const [i, point] of g.points.entries()) {
    const selected = i === result.selected, attrs = { fill: i === 5 ? '#9a472e' : '#086f68', stroke: selected ? '#183a37' : 'white', 'stroke-width': selected ? 3 : 1, 'data-infl-point': point.id };
    const mark = add(svg, i === 5 ? 'rect' : 'circle', i === 5 ? { ...attrs, x: point.x - 6, y: point.y - 6, width: 12, height: 12 } : { ...attrs, cx: point.x, cy: point.y, r: 6 });
    add(mark, 'title', {}, `${point.id}: x=${result.rows[i].x}, y=${result.rows[i].y}`);
    if (selected) add(svg, 'text', { x: point.x + (point.x > 560 ? -12 : 12), y: Math.max(39, point.y - 13), 'text-anchor': point.x > 560 ? 'end' : 'start', class: 'infl-label' }, point.id);
  }
  const point = result.rows[result.selected];
  svg.setAttribute('aria-label', `同一坐标中的全部六个观测：原五点为圆点，第六点为方点。绿色实线使用全部六点，棕色虚线是仅用于敏感性比较的不含 ${point.id} 拟合；点仍保留在图和数据中。竖虚线是完整拟合 residual。选中 ${point.id}，h=${display(point.leverage)}，e=${display(point.residual)}，Cook D=${display(point.cook)}。`);
}

export function mountInfluence(root) {
  if (root.dataset.influenceReady) return;
  root.classList.add('infl-lab');
  const controls = ['x', 'y'].map(kind => `<fieldset><legend>P6 的 ${kind}</legend><label for="infl-${kind}-range">滑块（${bounds[kind].join(' 到 ')}）</label><input id="infl-${kind}-range" type="range" min="${bounds[kind][0]}" max="${bounds[kind][1]}" step="0.1" value="${presets.online[kind]}" data-infl-range="${kind}"><label for="infl-${kind}-number">精确输入，步长 0.1</label><input id="infl-${kind}-number" type="number" min="${bounds[kind][0]}" max="${bounds[kind][1]}" step="0.1" value="${presets.online[kind]}" data-infl-number="${kind}"></fieldset>`).join('');
  const rows = Array.from({ length: 6 }, (_, i) => `<tr data-infl-row="${i}"><th scope="row">P${i + 1}</th>${['x', 'y', 'fitted', 'residual', 'leverage', 'cook'].map(key => `<td data-infl-cell="${i}-${key}"></td>`).join('')}</tr>`).join('');
  root.innerHTML = `<h3>同一个点：远离 x 中心，是否一定有影响？</h3><p>固定 P1–P5：x=[0,1,2,3,4]，y=[1,2,5,8,9]，其拟合为 ŷ=0.6+2.2x。只调节 P6，先保持 x=10，从“在线”切到“偏离原线”，观察 h 是否改变，再比较 residual 与 Cook’s D。</p>
    <div class="infl-controls">${controls}</div><div class="infl-actions"><button type="button" class="secondary" data-infl-preset="online" aria-pressed="true">高 leverage：在线 (10,22.6)</button><button type="button" class="secondary" data-infl-preset="offline" aria-pressed="false">高 leverage：偏离原线 (10,5)</button><button type="button" class="secondary" data-infl-preset="residual" aria-pressed="false">普通 x：大 residual (2,20)</button></div>
    <p class="infl-error" data-infl-error role="alert"></p>
    <div class="infl-selection-controls" role="group" aria-label="选择用于敏感性比较的一个观测">${Array.from({ length: 6 }, (_, i) => `<button type="button" class="secondary" data-infl-select="${i}" aria-pressed="${i === 5}">查看 P${i + 1}</button>`).join('')}</div>
    <div data-infl-results><p class="infl-note">圆点是原始 P1–P5，方点是可调的 P6；加粗外框与标签标出选中点。绿色实线：完整拟合；棕色虚线：不含选中点的敏感性拟合；竖虚线：到完整拟合线的 residual。</p>
    <figure><svg data-infl-plot="main" viewBox="0 0 680 390" role="img"></svg><figcaption>两条线共享固定 x∈[−5,15]、y∈[−12,42] 视窗。延长线在图边界截断，只影响绘图；所有点和诊断仍使用原始数值。两条线重合时，虚线会覆盖部分实线。</figcaption></figure>
    <details><summary>放大查看图形（窄屏可横向滚动）</summary><div class="infl-plot-scroll" tabindex="0" role="region" aria-label="放大的回归敏感性图，可横向滚动"><svg data-infl-plot="large" viewBox="0 0 680 390" role="img"></svg></div></details>
    <p class="infl-readout" data-infl-coefficients></p><p class="infl-readout" data-infl-selected aria-live="polite"></p>
    <h4>六个点的诊断均来自完整拟合</h4><p class="infl-note">窄屏请在表内横向滚动，读取 h 与 Cook D。选中点只改变敏感性参照，下面始终保留全部 6 个点。</p>
    <div class="infl-table-wrap" tabindex="0" role="region" aria-label="全部六点的完整拟合诊断，可横向滚动"><table><thead><tr><th scope="col">ID</th><th scope="col">x</th><th scope="col">y</th><th scope="col">ŷ（完整）</th><th scope="col">e=y−ŷ</th><th scope="col">h</th><th scope="col">Cook D</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p data-infl-checks></p><p class="infl-note">hᵢ=1/6+(xᵢ−x̄)²/Sxx；eᵢ=yᵢ−ŷᵢ；Dᵢ=[eᵢ²/(2×MSE)]×hᵢ/(1−hᵢ)²。分母的 2 是完整模型的两个回归系数（截距与 slope）；MSE=SSE/(6−2)。</p>
    <p class="infl-note">h 只由 x 决定。Cook D 结合 residual、leverage 与完整模型的 MSE，反映暂时不含该点时整体拟合的改变；不能只按 |e| 找最有影响的点。在线例中理论上为 0 的量可能显示为极小科学计数，这是浮点舍入。</p></div>
    <details><summary>用当前六点与选中点在 base R 中核对</summary><button type="button" class="secondary" data-infl-copy disabled>复制当前 R 代码</button><pre data-infl-code></pre><p class="infl-note" data-infl-copy-status role="status"></p></details>
    <p class="infl-note">每个 ID 代表一个实验单位的一对 (x,y) 记录，独立性仍需数据来源支持；此原创教学例不建立因果关系。“不含选中点”仅作敏感性比较，原数据没有删除。诊断较大是核查记录、模型和数据来源的线索，不是自动剔除观测的理由。</p>`;
  const $ = selector => root.querySelector(selector), numbers = ['x', 'y'].map(kind => $(`[data-infl-number="${kind}"]`)), ranges = ['x', 'y'].map(kind => $(`[data-infl-range="${kind}"]`));
  const selectors = Array.from({ length: 6 }, (_, i) => $(`[data-infl-select="${i}"]`)), copy = $('[data-infl-copy]');
  const presetButtons = Object.fromEntries(Object.keys(presets).map(name => [name, $(`[data-infl-preset="${name}"]`)]));
  let selected = 5, result = null, revision = 0;
  function update() {
    revision++; $('[data-infl-copy-status]').textContent = '';
    try {
      const x = parseInfluenceValue(numbers[0].value, 'x'), y = parseInfluenceValue(numbers[1].value, 'y');
      result = influenceAnalysis({ x, y, selected }); ranges[0].value = String(x); ranges[1].value = String(y);
      for (const [name, preset] of Object.entries(presets)) presetButtons[name].setAttribute('aria-pressed', String(x === preset.x && y === preset.y));
      numbers.forEach(input => input.setAttribute('aria-invalid', 'false')); $('[data-infl-error]').textContent = ''; $('[data-infl-results]').hidden = false;
      selectors.forEach((button, i) => { button.disabled = false; button.setAttribute('aria-pressed', String(i === selected)); });
      for (const kind of ['main', 'large']) drawInfluence($(`[data-infl-plot="${kind}"]`), result);
      const line = fit => `${display(fit.intercept)} ${fit.slope < 0 ? '−' : '+'} ${display(Math.abs(fit.slope))}x`;
      $('[data-infl-coefficients]').textContent = `完整拟合（6 点）：ŷ=${line(result.full)}；敏感性拟合（暂不含 P${selected + 1} 的 5 点）：ŷ=${line(result.without)}。后者减前者：截距变化 ${display(result.coefficientChange.intercept)}，slope 变化 ${display(result.coefficientChange.slope)}。`;
      const row = result.rows[selected];
      const rangeNote = result.selectedExtrapolation ? `剩余 5 点的 x 范围是 [${result.remainingRange.join(',')}]；该 x 在范围外，敏感性线的此值属于外推，仅用于诊断两条线，不能作为经验证的新观测预测。` : `该 x 位于剩余 5 点的范围 [${result.remainingRange.join(',')}] 内。`;
      $('[data-infl-selected]').textContent = `选中 ${row.id}：(x,y)=(${row.x},${row.y})；完整拟合 ŷ=${display(row.fitted)}，e=${display(row.residual)}，h=${display(row.leverage)}，Cook D=${display(row.cook)}。敏感性线在该 x 的拟合值=${display(row.sensitivityFitted)}。${rangeNote}原数据仍保留全部 6 点。`;
      result.rows.forEach(row => {
        $(`[data-infl-row="${row.index}"]`).setAttribute('data-selected', String(row.index === selected));
        for (const key of ['x', 'y', 'fitted', 'residual', 'leverage', 'cook']) $(`[data-infl-cell="${row.index}-${key}"]`).textContent = display(row[key]);
      });
      $('[data-infl-checks]').textContent = `完整拟合：x̄=${display(result.full.xb)}，Sxx=${display(result.full.sxx)}，SSE=${display(result.full.sse)}，MSE=${display(result.full.mse)}（error df=4）。Σh=${display(result.sumLeverage)}，等于系数个数 2。`;
      $('[data-infl-code]').textContent = influenceRCode({ x, y, selected }); copy.disabled = false;
    } catch (error) {
      result = null; numbers.forEach(input => input.setAttribute('aria-invalid', 'true'));
      Object.values(presetButtons).forEach(button => button.setAttribute('aria-pressed', 'false'));
      $('[data-infl-error]').textContent = `${error.message} 当前设置尚无有效结果，请修正输入或载入预设。`; $('[data-infl-results]').hidden = true;
      for (const kind of ['main', 'large']) { const graph = $(`[data-infl-plot="${kind}"]`); graph.replaceChildren(); graph.setAttribute('aria-label', '等待有效的第六点坐标'); }
      selectors.forEach(button => button.disabled = true); $('[data-infl-code]').textContent = ''; copy.disabled = true;
    }
  }
  ['x', 'y'].forEach((kind, i) => {
    ranges[i].addEventListener('input', () => { numbers[i].value = ranges[i].value; update(); });
    numbers[i].addEventListener('input', update);
  });
  selectors.forEach((button, i) => button.addEventListener('click', () => { selected = i; update(); }));
  for (const [name, preset] of Object.entries(presets)) presetButtons[name].addEventListener('click', () => { numbers[0].value = String(preset.x); numbers[1].value = String(preset.y); selected = 5; update(); });
  copy.addEventListener('click', async () => {
    if (!result) return;
    const version = revision, code = $('[data-infl-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-infl-copy-status]').textContent = '已复制当前六点、完整拟合诊断与选中点的敏感性比较。'; }
    catch { if (version === revision) $('[data-infl-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; }
  });
  update(); root.dataset.influenceReady = 'true';
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-influence]').forEach(mountInfluence);
