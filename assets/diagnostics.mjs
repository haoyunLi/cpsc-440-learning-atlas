import * as M from './math.mjs';

export const diagnosticModes = ['normal', 'skew', 'outlier', 'unequal'];
export function diagnosticData(mode = 'normal') {
  if (!diagnosticModes.includes(mode)) throw Error('未知诊断场景');
  const rng = M.seeded(440);
  const groups = [10, 13, 16].map((center, group) => Array.from({ length: 16 }, (_, i) => {
    const z = M.randomNormal(rng);
    const error = mode === 'skew' ? Math.exp(z * .9) - Math.exp(.405) : z * (mode === 'unequal' ? [.45, 1, 2.8][group] : 1);
    return center + error + (mode === 'outlier' && group === 2 && i === 15 ? 12 : 0);
  }));
  const fitted = groups.map(M.mean);
  const points = groups.flatMap((group, g) => group.map((value, i) => ({ id: `G${g + 1}-${String(i + 1).padStart(2, '0')}`, index: g * 16 + i, value, group: g, fitted: fitted[g], residual: value - fitted[g], special: mode === 'outlier' && g === 2 && i === 15 })));
  // Preserve observation identity while sorting; tied residuals retain original
  // ID order, rather than replacing the Q-Q positions by average ranks.
  const ordered = [...points].sort((a, b) => a.residual - b.residual || a.index - b.index), n = points.length;
  const a = n <= 10 ? .375 : .5;
  ordered.forEach((point, i) => {
    point.order = i + 1;
    point.probability = (i + 1 - a) / (n + 1 - 2 * a);
    point.theoretical = M.normalQuantile(point.probability);
  });
  const sorted = ordered.map(point => point.residual), theoretical = ordered.map(point => point.theoretical);
  const slope = (M.quantile(sorted, .75) - M.quantile(sorted, .25)) / (M.normalQuantile(.75) - M.normalQuantile(.25));
  const intercept = M.quantile(sorted, .25) - slope * M.normalQuantile(.25);
  return { mode, groups, points, ordered, sorted, theoretical, slope, intercept, n };
}

const show = value => value === 0 ? '0' : Math.abs(value) < .0001 ? value.toExponential(4) : String(Number(value.toPrecision(7)));
export function diagnosticsRCode(data, selectedId = 'G1-01', count = 48) {
  if (!data?.points?.some(point => point.id === selectedId) || !Number.isInteger(count) || count < 1 || count > data.n) throw Error('请先选择有效的诊断观测与显示数量。');
  const ids = data.points.map(point => `"${point.id}"`).join(', ');
  return `# Fixed teaching observations from the browser, not a new R random draw.
# Scenario: ${data.mode}. Every observation is retained, including the outlier.
d <- data.frame(id=c(${ids}),
                group=factor(rep(c("G1","G2","G3"),each=16)),
                y=c(${data.points.map(point => String(point.value)).join(', ')}))
fit <- lm(y ~ group, data=d)
d$fitted <- fitted(fit)
d$residual <- residuals(fit)
N <- nrow(d)
# Break exact residual ties by the original row order; do not average positions.
ord <- order(d$residual, seq_len(N))
d$order <- integer(N)
d$order[ord] <- seq_len(N)
d$probability <- numeric(N)
d$probability[ord] <- ppoints(N)
d$normal_quantile <- qnorm(d$probability)
# Match qqline's default type-7 quartiles using the full set of residuals.
sample_quartiles <- quantile(d$residual,c(.25,.75),type=7,names=FALSE)
normal_quartiles <- qnorm(c(.25,.75))
qq_slope <- diff(sample_quartiles)/diff(normal_quartiles)
qq_intercept <- sample_quartiles[1]-qq_slope*normal_quartiles[1]
selected_id <- "${selectedId}"
shown_count <- ${count}
d$shown <- seq_len(N) <= shown_count
print(d)
print(d[d$id==selected_id,])
print(aggregate(residual ~ group,data=d,FUN=sum))
print(c(qq_intercept=qq_intercept,qq_slope=qq_slope))
# Both displays reveal the same original IDs. Fitting, sorting and the reference
# line always use all 48 observations, even during a partially revealed view.
old_par <- par(mfrow=c(1,2))
plot(d$fitted,d$residual,type="n",xlab="Fitted group mean",ylab="Residual")
abline(h=0,lty=2)
points(d$fitted[d$shown],d$residual[d$shown],pch=19)
selected <- d$id==selected_id & d$shown
points(d$fitted[selected],d$residual[selected],pch=1,cex=1.8,col="brown")
plot(d$normal_quantile,d$residual,type="n",xlab="Theoretical normal quantile",ylab="Ordered residual")
abline(a=qq_intercept,b=qq_slope,lty=2)
points(d$normal_quantile[d$shown],d$residual[d$shown],pch=19)
points(d$normal_quantile[selected],d$residual[selected],pch=1,cex=1.8,col="brown")
par(old_par)
# Group-centered residuals sum to zero within each group, up to roundoff.
# A Q-Q reference line is a diagnostic guide, not a confidence band or proof
# of normality. Neither plot can establish independence from the study design.`;
}

export function diagnosticGeometry(data, type = 'residual') {
  if (!['residual', 'qq'].includes(type)) throw Error('未知诊断图');
  const minimum = Math.min(...data.sorted), maximum = Math.max(...data.sorted);
  const padding = Math.max(.5, (maximum - minimum) * .08);
  const yMin = minimum - padding, yMax = maximum + padding;
  const xMin = type === 'qq' ? -2.5 : Math.min(...data.points.map(point => point.fitted)) - 1;
  const xMax = type === 'qq' ? 2.5 : Math.max(...data.points.map(point => point.fitted)) + 1;
  const x = value => 86 + (value - xMin) / (xMax - xMin) * 532;
  const y = value => 267 - (value - yMin) / (yMax - yMin) * 214;
  return { xMin, xMax, yMin, yMax, x, y, points: data.points.map(point => ({ id: point.id, x: x(type === 'qq' ? point.theoretical : point.fitted), y: y(point.residual) })) };
}
const svgNS = 'http://www.w3.org/2000/svg';
function add(svg, tag, attributes, text = '') {
  const node = (svg.ownerDocument || document).createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  svg.append(node); return node;
}
export function drawDiagnostics(svg, data, type = 'residual', count = 48, selectedId = 'G1-01') {
  if (!Number.isInteger(count) || count < 1 || count > data.n || !data.points.some(point => point.id === selectedId)) throw Error('无效的诊断显示设置');
  svg.replaceChildren();
  const g = diagnosticGeometry(data, type);
  add(svg, 'line', { x1: 86, x2: 618, y1: 267, y2: 267, class: 'diag-axis' });
  add(svg, 'line', { x1: 86, x2: 86, y1: 53, y2: 267, class: 'diag-axis' });
  for (let i = 0; i <= 4; i++) {
    const xv = g.xMin + (g.xMax - g.xMin) * i / 4, yv = g.yMin + (g.yMax - g.yMin) * i / 4;
    add(svg, 'text', { x: g.x(xv), y: 293, 'text-anchor': 'middle', class: 'diag-tick' }, String(Number(xv.toFixed(1))));
    add(svg, 'text', { x: 76, y: g.y(yv) + 5, 'text-anchor': 'end', class: 'diag-tick' }, String(Number(yv.toFixed(1))));
  }
  add(svg, 'text', { x: 86, y: 28, class: 'diag-label' }, type === 'qq' ? '排序后的 residual e' : 'Residual e = Y − ŷ');
  add(svg, 'text', { x: 352, y: 329, 'text-anchor': 'middle', class: 'diag-label' }, type === 'qq' ? 'Normal theoretical quantile qᵢ' : 'Fitted group mean ŷ');
  if (type === 'residual') add(svg, 'line', { x1: 86, x2: 618, y1: g.y(0), y2: g.y(0), stroke: '#9a472e', 'stroke-dasharray': '5 4' });
  else {
    const lo = Math.max(g.xMin, (g.yMin - data.intercept) / data.slope), hi = Math.min(g.xMax, (g.yMax - data.intercept) / data.slope);
    add(svg, 'line', { x1: g.x(lo), x2: g.x(hi), y1: g.y(data.intercept + data.slope * lo), y2: g.y(data.intercept + data.slope * hi), stroke: '#9a472e', 'stroke-dasharray': '5 4' });
  }
  for (const point of data.points.slice(0, count)) {
    const position = g.points[point.index];
    const node = add(svg, 'circle', { cx: position.x, cy: position.y, r: point.special ? 6 : 4.5, fill: point.special ? '#9a472e' : '#086f68', 'data-diag-id': point.id });
    add(node, 'title', {}, `${point.id}：Y=${show(point.value)}，ŷ=${show(point.fitted)}，e=${show(point.residual)}，排序 i=${point.order}，q=${show(point.theoretical)}`);
  }
  const selected = data.points.find(point => point.id === selectedId);
  if (selected.index < count) {
    const position = g.points[selected.index];
    add(svg, 'circle', { cx: position.x, cy: position.y, r: 10, fill: 'none', stroke: '#183a37', 'stroke-width': 2, 'data-diag-selected': selectedId });
  }
  svg.setAttribute('aria-label', `${type === 'qq' ? 'Normal Q–Q 图' : 'Residual versus fitted 图'}；显示同一批 ${count} 个观测，选中 ${selectedId}，残差 ${show(selected.residual)}，完整排序位置 ${selected.order}/48。两图的纵坐标都是同一 residual。完整数值见下表。`);
}

const narratives = {
  normal: '同方差 normal 基准：残差大致围绕 0，各组散布接近。有限样本 Q–Q 不会完美成线；不能把任意偏离都判为失败。',
  skew: '右偏误差：大正残差较突出，Q–Q 上端偏离。关注偏态程度与每组样本量；可讨论有科学意义的变换或更适合的模型，不是只追求一个通过的检验。',
  outlier: 'G3-16 的原始 Y 额外增加 12，第三组 fitted mean 增加 12/16=.75；该点 residual 增加 11.25，其余该组 residual 都减少 .75。该点始终保留；先核查记录与测量，再报告敏感性分析。',
  unequal: '误差 SD 分别设为 .45、1、2.8：残差散布随组增大。共同 variance 假设值得怀疑；Welch one-way、合理变换或匹配的 variance model 是后续方向。'
};
export function mountDiagnostics(root) {
  if (root.dataset.diagnosticsReady) return;
  root.classList.add('diag-lab');
  const initial = diagnosticData();
  root.innerHTML = `<h2>诊断图：追踪同一个观测</h2><p>三组各 16 个观测，固定 seed=440 的教学数据。完整拟合 one-way ANOVA：每个 fitted value 都是所在组 mean。先选一个 ID，核对 Y→ŷ→e，再看它在两张图中的位置。</p>
    <div class="diag-controls"><label>数据生成机制<select data-diag-mode data-field="mode"><option value="normal">Normal：同方差基准</option><option value="skew">Skew：右偏误差</option><option value="outlier">Outlier：G3-16 额外增加 12</option><option value="unequal">Unequal：各组误差 SD 不同</option></select></label><label>追踪观测（选点后显示全部）<select data-diag-point>${initial.points.map(point => `<option value="${point.id}">${point.id} · 第 ${point.group + 1} 组</option>`).join('')}</select></label></div>
    <div class="diag-actions"><button type="button" data-action="step">逐点显示</button><button type="button" data-action="play" aria-pressed="false">播放诊断过程</button><button type="button" class="secondary" data-action="all">显示全部</button></div>
    <p data-diag-error class="diag-error" role="alert"></p><p data-diag-progress class="diag-note" aria-live="polite"></p><div data-diag-selected class="diag-readout" aria-live="polite"></div>
    <div class="diag-plots"><figure><svg data-diag-plot="residual" viewBox="0 0 650 350" role="img" aria-label="Residual versus fitted"></svg><figcaption>第一张图坐标是 (ŷ,e)。检查各组的残差散布与极端值；组内残差和为 0，三列 fitted group means 不是连续 x 的曲率诊断。</figcaption></figure><figure><svg data-diag-plot="qq" viewBox="0 0 650 350" role="img" aria-label="Normal Q–Q"></svg><figcaption>第二张图坐标是 (qᵢ,e)，只换横坐标，ID 与纵坐标不变。黑色外圈标出选中 ID；棕色点是 outlier 场景中被加 12 的观测。</figcaption></figure></div>
    <details class="diag-zoom"><summary>放大查看两张图（可横向滚动）</summary><div class="diag-scroll" role="region" aria-label="放大的诊断图，可横向滚动" tabindex="0"><svg data-diag-zoom="residual" viewBox="0 0 650 350" role="img" aria-label="放大的 Residual versus fitted"></svg><svg data-diag-zoom="qq" viewBox="0 0 650 350" role="img" aria-label="放大的 Normal Q–Q"></svg></div></details>
    <p data-diag-narrative></p><p class="diag-note">逐点显示时，两图按原始 ID 顺序揭示同一批观测，并追踪最新一条。数据、拟合、48 个 residual 的完整排序及参考线始终不变；不是每一步重新拟合。手动选择 ID 会暂停播放并显示全部。模式切换保留选中 ID，数值和排序位置随新数据更新。</p>
    <details><summary>逐行核对 Y、fitted、residual 与 Q–Q 坐标</summary><p class="diag-note">i 是 residual 从小到大的排列位置；相同 residual 按原始 ID 顺序排列，不使用 average rank。这里 n=48，R ppoints(48) 给 pᵢ=(i−.5)/48，qᵢ=Φ⁻¹(pᵢ)。显示数值经过四舍五入，计算使用完整精度。表始终保留全部记录，“已显示”只描述当前动画。小屏可在表内横向滚动。</p><div class="diag-scroll" role="region" aria-label="48 个观测的诊断数值，可横向滚动" tabindex="0"><table><caption>完整拟合的逐行计算；点击 ID 可在两图追踪</caption><thead><tr><th scope="col">观测 ID</th><th scope="col">Y</th><th scope="col">fitted ŷ</th><th scope="col">residual e</th><th scope="col">排序 i</th><th scope="col">pᵢ</th><th scope="col">qᵢ</th><th scope="col">已显示</th></tr></thead><tbody>${initial.points.map(point => `<tr data-diag-row="${point.id}"><th scope="row"><button type="button" class="secondary" data-diag-select value="${point.id}">${point.id}</button></th>${['value', 'fitted', 'residual', 'order', 'probability', 'theoretical', 'shown'].map(key => `<td data-diag-cell="${point.id}:${key}"></td>`).join('')}</tr>`).join('')}</tbody></table></div></details>
    <details><summary>用当前完整数据与选中 ID 在 R 中复现</summary><button type="button" class="secondary" data-diag-copy>复制当前 R 代码</button><pre data-diag-code></pre><p data-diag-copy-status class="diag-note" role="status"></p></details>
    <details><summary>参考线与诊断的边界</summary><p>Q–Q 虚线穿过样本 residual 与理论 normal 的 25%、75% quantiles，采用 R qqline 默认的 type 7 样本分位数；它不是置信带。相同 residual 的 Q–Q 纵坐标相同，但各占一个排列位置，所有观测仍被保留。</p><p>这些图不能证明 normality、equal variance 或 independence。独立性主要由抽样、随机化与实验单位决定；拟合后的 residuals 也并非严格相互独立。<a href="chapters/08.html#diagnostics">回到 ANOVA 诊断讲解</a>。连续 predictor 回归需使用其自身模型的 residuals；弯曲均值关系与 lack of fit 见<a href="chapters/11.html#lack-fit">Ch11 模型诊断</a>。</p></details>`;
  const $ = selector => root.querySelector(selector);
  const modeControl = $('[data-diag-mode]'), pointControl = $('[data-diag-point]');
  const buttons = [...root.querySelectorAll('[data-diag-select]')];
  const play = $('[data-action="play"]');
  const plots = ['residual', 'qq'].flatMap(type => [{ type, svg: $(`[data-diag-plot="${type}"]`) }, { type, svg: $(`[data-diag-zoom="${type}"]`) }]);
  let data = initial, count = 48, selectedId = 'G1-01', timer = null, code = '', revision = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function stop() { if (timer !== null) clearInterval(timer); timer = null; play.textContent = '播放诊断过程'; play.setAttribute('aria-pressed', 'false'); }
  function syncMotion() { if (reduced.matches) stop(); play.disabled = reduced.matches || !data; play.title = reduced.matches ? '减少动态偏好已启用，请使用逐点显示。' : ''; }
  function render() {
    revision++; $('[data-diag-copy-status]').textContent = '';
    const selected = data.points.find(point => point.id === selectedId);
    pointControl.value = selectedId;
    plots.forEach(({ svg, type }) => drawDiagnostics(svg, data, type, count, selectedId));
    $('[data-diag-progress]').textContent = `已显示 ${count} / 48 个观测；两图使用相同 ID 集合。当前追踪 ${selectedId}。`;
    $('[data-diag-selected]').innerHTML = `<strong>${selectedId}：${show(selected.value)} − ${show(selected.fitted)} ≈ ${show(selected.residual)}</strong><span>Y − 第 ${selected.group + 1} 组 mean = residual。第一张图坐标 (ŷ,e)=(${show(selected.fitted)}, ${show(selected.residual)})。</span><span>该 residual 在完整 48 点中排第 i=${selected.order}；pᵢ=(${selected.order}−.5)/48≈${show(selected.probability)}；qᵢ=Φ⁻¹(pᵢ)≈${show(selected.theoretical)}。第二张图坐标 (qᵢ,e)=(${show(selected.theoretical)}, ${show(selected.residual)})。</span>`;
    $('[data-diag-narrative]').textContent = narratives[data.mode];
    for (const point of data.points) {
      for (const key of ['value', 'fitted', 'residual', 'order', 'probability', 'theoretical']) $(`[data-diag-cell="${point.id}:${key}"]`).textContent = show(point[key]);
      $(`[data-diag-cell="${point.id}:shown"]`).textContent = point.index < count ? '是' : '尚未';
      $(`[data-diag-row="${point.id}"]`).classList.toggle('diag-current', point.id === selectedId);
    }
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.value === selectedId)));
    code = diagnosticsRCode(data, selectedId, count); $('[data-diag-code]').textContent = code; $('[data-diag-copy]').disabled = false;
  }
  function updateMode() {
    stop();
    try {
      data = diagnosticData(modeControl.value); count = 48;
      $('[data-diag-error]').textContent = ''; pointControl.disabled = false;
      for (const action of ['step', 'all']) $(`[data-action="${action}"]`).disabled = false;
      buttons.forEach(button => button.disabled = false);
      syncMotion(); render();
    } catch (error) {
      data = null; code = ''; revision++;
      $('[data-diag-error]').textContent = error.message;
      $('[data-diag-selected]').textContent = '等待有效诊断场景。';
      for (const key of ['progress', 'narrative', 'code', 'copy-status']) $(`[data-diag-${key}]`).textContent = '';
      plots.forEach(({ svg }) => { svg.replaceChildren(); svg.setAttribute('aria-label', '等待有效诊断场景。'); });
      for (const point of initial.points) for (const key of ['value', 'fitted', 'residual', 'order', 'probability', 'theoretical', 'shown']) $(`[data-diag-cell="${point.id}:${key}"]`).textContent = '—';
      pointControl.disabled = true; $('[data-diag-copy]').disabled = true;
      for (const action of ['step', 'all']) $(`[data-action="${action}"]`).disabled = true;
      buttons.forEach(button => button.disabled = true); syncMotion();
    }
  }
  function select(id) {
    if (!data || !data.points.some(point => point.id === id)) { pointControl.value = selectedId; return; }
    stop(); selectedId = id; count = 48; render();
  }
  function advance() { count = count >= 48 ? 1 : count + 1; selectedId = data.points[count - 1].id; render(); if (count >= 48) stop(); }
  modeControl.addEventListener('input', updateMode); modeControl.addEventListener('change', updateMode);
  pointControl.addEventListener('change', () => select(pointControl.value));
  buttons.forEach(button => button.addEventListener('click', () => select(button.value)));
  $('[data-action="step"]').addEventListener('click', () => { if (!data) return; stop(); advance(); });
  $('[data-action="all"]').addEventListener('click', () => { if (!data) return; stop(); count = 48; render(); });
  play.addEventListener('click', () => {
    if (!data || reduced.matches) return;
    if (timer !== null) { stop(); return; }
    if (count >= 48) advance();
    timer = setInterval(advance, 350); play.textContent = '暂停'; play.setAttribute('aria-pressed', 'true');
  });
  reduced.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  if ('IntersectionObserver' in window) new window.IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(root);
  $('[data-diag-copy]').addEventListener('click', async () => {
    if (!code) return;
    const copiedCode = code, copiedRevision = revision;
    try { await navigator.clipboard.writeText(copiedCode); $('[data-diag-copy-status]').textContent = copiedRevision === revision ? '已复制当前完整数据、选中 ID 与显示状态的 R 代码。' : '已复制点击时的数据与 ID；当前显示已改变，请重新复制。'; }
    catch { if (copiedRevision === revision) $('[data-diag-copy-status]').textContent = '自动复制不可用；请选中上方完整代码复制。'; }
  });
  updateMode(); root.dataset.diagnosticsReady = 'true';
}
