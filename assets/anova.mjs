import { fSurvival } from './math.mjs';

const groupNames = ['A', 'B', 'C'], pattern = [-1, 0, 1];
const ids = groupNames.flatMap(name => [1, 2, 3].map(j => name + j));
const show = value => value === 0 || value === 1 ? String(value) : Math.abs(value) < .0001 ? value.toExponential(5) : Number(value.toPrecision(8)).toString();
function selectedRow(result, id) { const row = result.rows.find(item => item.id === id); if (!row) throw Error('请选择 A1–C3 中一个观测。'); return row; }
function validControl(value, kind) {
  const minimum = kind === 'gap' ? 0 : .25, maximum = kind === 'gap' ? 6 : 5;
  if (!Number.isFinite(value) || value < minimum || value > maximum || !Number.isInteger(value * 4)) throw Error(`${kind === 'gap' ? '组中心间距' : '组内残差倍数'}须为 ${minimum}–${maximum}，步长 0.25。`);
  return value;
}

export function anovaAnalysis({ gap = 3, noise = 1 } = {}) {
  validControl(gap, 'gap'); validControl(noise, 'noise');
  const rows = groupNames.flatMap((group, i) => pattern.map((residual, j) => ({ id: group + (j + 1), group, gi: i, j,
    value: 5 + i * gap + residual * noise })));
  const N = rows.length, k = groupNames.length, grandMean = rows.reduce((sum, row) => sum + row.value, 0) / N;
  const groups = groupNames.map((group, i) => {
    const own = rows.filter(row => row.group === group), mean = own.reduce((sum, row) => sum + row.value, 0) / own.length;
    return { group, index: i, n: own.length, mean };
  });
  for (const row of rows) {
    row.groupMean = groups[row.gi].mean; row.total = row.value - grandMean;
    row.between = row.groupMean - grandMean; row.residual = row.value - row.groupMean;
    row.totalSquare = row.total ** 2; row.betweenSquare = row.between ** 2; row.residualSquare = row.residual ** 2;
    row.cross = row.between === 0 || row.residual === 0 ? 0 : 2 * row.between * row.residual;
  }
  for (const group of groups) {
    const own = rows.filter(row => row.group === group.group);
    group.residualSum = own.reduce((sum, row) => sum + row.residual, 0);
    group.crossSum = own.reduce((sum, row) => sum + row.cross, 0);
    group.sse = own.reduce((sum, row) => sum + row.residualSquare, 0);
    group.ssb = group.n * (group.mean - grandMean) ** 2;
  }
  const sum = key => rows.reduce((total, row) => total + row[key], 0);
  const sst = sum('totalSquare'), ssb = sum('betweenSquare'), sse = sum('residualSquare'), crossSum = sum('cross');
  const dfBetween = k - 1, dfError = N - k, dfTotal = N - 1, msBetween = ssb / dfBetween, mse = sse / dfError, f = msBetween / mse;
  return { gap, noise, rows, groups, N, k, grandMean, sst, ssb, sse, crossSum, dfBetween, dfError, dfTotal, msBetween, mse, f, p: fSurvival(f, dfBetween, dfError) };
}

export function anovaRCode(settings = {}, selectedId = 'A1') {
  const r = anovaAnalysis(settings); selectedRow(r, selectedId);
  return `# Constructed teaching data, not a random sample or Monte Carlo run.
# Each row represents a distinct hypothetical experimental unit.
gap <- ${r.gap}
noise <- ${r.noise}
d <- data.frame(id=c(${r.rows.map(row => '"' + row.id + '"').join(',')}),
                group=factor(rep(c("A","B","C"),each=3)),
                y=c(${r.rows.map(row => row.value).join(',')}))
selected_id <- "${selectedId}"
group_means <- tapply(d$y,d$group,mean)
group_n <- table(d$group)
grand <- mean(d$y)
weighted_grand <- sum(as.numeric(group_n)*group_means)/sum(group_n)
d$group_mean <- ave(d$y,d$group,FUN=mean)
d$total <- d$y-grand
d$between <- d$group_mean-grand
d$residual <- d$y-d$group_mean
d$total_square <- d$total^2
d$between_square <- d$between^2
d$residual_square <- d$residual^2
d$cross <- 2*d$between*d$residual
print(d)
print(d[d$id==selected_id,])
print(data.frame(group=names(group_means),n=as.numeric(group_n),mean=group_means))
print(c(grand_mean=grand,weighted_grand_mean=weighted_grand))
# Within each fitted group, residuals sum to zero. Its between component
# is constant, so the sum of 2*between*residual is also zero.
group_sums <- aggregate(cbind(residual,cross)~group,data=d,FUN=sum)
print(group_sums)
SST <- sum(d$total_square)
SStrt <- sum(d$between_square)
SSE <- sum(d$residual_square)
N <- nrow(d)
k <- nlevels(d$group)
df_between <- k-1
df_error <- N-k
MS_between <- SStrt/df_between
MSE <- SSE/df_error
F_value <- MS_between/MSE
p_value <- pf(F_value,df_between,df_error,lower.tail=FALSE)
print(c(SST=SST,SStrt=SStrt,SSE=SSE,cross_sum=sum(d$cross),
        df_between=df_between,df_error=df_error,df_total=N-1,
        MS_between=MS_between,MSE=MSE,F_value=F_value,p_value=p_value),digits=12)
fit <- aov(y~group,data=d)
print(summary(fit))
stopifnot(abs(grand-weighted_grand)<1e-12,
          max(abs(d$total-d$between-d$residual))<1e-12,
          max(abs(d$total_square-d$between_square-d$residual_square-d$cross))<1e-12,
          max(abs(group_sums$residual))<1e-12,max(abs(group_sums$cross))<1e-12,
          abs(SST-SStrt-SSE)<1e-12,abs(SSE-sum(residuals(fit)^2))<1e-10)
# Exact F inference requires independent normal errors and common variance.
# The between component is fitted group deviation, not a proven causal effect.
# Gap zero forces equal SAMPLE means here; it does not imply that random
# samples drawn under an equal-POPULATION-means null always have F=0.
# A small omnibus P does not establish which particular groups differ.`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const element = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
const yPosition = value => 292 - (value + 2) / 26 * 240;
const xPosition = value => 126 + (value + 2) / 26 * 474;
export function drawAnova(svg, result, selectedId = 'A1') {
  svg.replaceChildren(); if (!result) { svg.setAttribute('aria-label', '等待有效 ANOVA 构造设置'); return; }
  const selected = selectedRow(result, selectedId);
  for (const tick of [0, 5, 10, 15, 20]) {
    add(svg, 'line', { x1: 80, x2: 625, y1: yPosition(tick), y2: yPosition(tick), stroke: '#ccd6cf' });
    add(svg, 'text', { x: 66, y: yPosition(tick) + 6, 'text-anchor': 'end', class: 'anov-tick' }, tick);
  }
  add(svg, 'text', { x: 80, y: 28, class: 'anov-label' }, 'Response Y');
  add(svg, 'line', { x1: 80, x2: 625, y1: yPosition(result.grandMean), y2: yPosition(result.grandMean), stroke: '#50655f', 'stroke-dasharray': '6 5', 'data-anov-grand': result.grandMean });
  for (const group of result.groups) {
    const center = 170 + group.index * 180;
    add(svg, 'line', { x1: center - 58, x2: center + 58, y1: yPosition(group.mean), y2: yPosition(group.mean), stroke: '#9a472e', 'stroke-width': 3, 'data-anov-group-mean': group.group });
    add(svg, 'text', { x: center, y: 330, 'text-anchor': 'middle', class: 'anov-label' }, group.group);
  }
  for (const row of result.rows) {
    const chosen = row.id === selectedId, x = 170 + row.gi * 180 + (row.j - 1) * 30;
    if (chosen) add(svg, 'line', { x1: x, x2: x, y1: yPosition(row.groupMean), y2: yPosition(row.value), stroke: '#183a37', 'stroke-width': 2, 'stroke-dasharray': '2 3', 'data-anov-selected-residual': row.id });
    add(svg, 'circle', { cx: x, cy: yPosition(row.value), r: chosen ? 7 : 5, fill: '#086f68', stroke: chosen ? '#183a37' : '#fff', 'stroke-width': chosen ? 3 : 1,
      'data-anov-point': row.id, 'data-selected': chosen });
    if (chosen) add(svg, 'text', { x: x, y: yPosition(row.value) - 15, 'text-anchor': 'middle', class: 'anov-label', 'font-weight': 700 }, row.id);
  }
  svg.setAttribute('aria-label', `九个构造观测，A/B/C 各三个；绿色点为观测，棕色短线为组均值，灰色虚线为全部观测的 grand mean ${show(result.grandMean)}。选择 ${selected.id}=${show(selected.value)}；组均值 ${show(selected.groupMean)}，residual=${show(selected.residual)}。所有设置共用纵轴 −2 至 24；同组点的横向错开只为辨识。`);
}

// Endpoint arrows preserve the sign of each deviation. Segment length is a
// response difference, not a squared distance or a sum-of-squares contribution.
function directedSegment(svg, start, end, y, color, key) {
  const x1 = xPosition(start), x2 = xPosition(end);
  add(svg, 'line', { x1, x2, y1: y, y2: y, stroke: color, 'stroke-width': 4, 'data-anov-segment': key });
  add(svg, 'circle', { cx: x1, cy: y, r: 4, fill: '#fff', stroke: color, 'stroke-width': 2 });
  if (start === end) add(svg, 'circle', { cx: x2, cy: y, r: 5, fill: color, 'data-anov-zero': key });
  else {
    const direction = Math.sign(x2 - x1), head = Math.min(8, Math.abs(x2 - x1) * .55), halfHeight = head * .75;
    add(svg, 'path', { d: `M${x2 - direction * head},${y - halfHeight} L${x2},${y} L${x2 - direction * head},${y + halfHeight}`, fill: 'none', stroke: color, 'stroke-width': 3, 'data-anov-arrow': key });
  }
}
export function drawAnovaDecomposition(svg, result, selectedId = 'A1') {
  svg.replaceChildren(); if (!result) { svg.setAttribute('aria-label', '等待选中观测的偏差分解'); return; }
  const row = selectedRow(result, selectedId), g = result.grandMean, m = row.groupMean, value = row.value;
  const parts = [
    { key: 'total', name: '总偏差', start: g, end: value, value: row.total, y: 77, color: '#183a37' },
    { key: 'between', name: '组间偏差', start: g, end: m, value: row.between, y: 155, color: '#086f68' },
    { key: 'residual', name: '组内残差', start: m, end: value, value: row.residual, y: 233, color: '#9a472e' }
  ];
  add(svg, 'text', { x: 126, y: 25, class: 'anov-label' }, `${row.id}：沿共同响应轴有方向地移动`);
  for (const part of parts) {
    add(svg, 'text', { x: 110, y: part.y + 6, 'text-anchor': 'end', class: 'anov-label' }, part.name);
    add(svg, 'line', { x1: 126, x2: 600, y1: part.y, y2: part.y, stroke: '#e8efea' });
    directedSegment(svg, part.start, part.end, part.y, part.color, part.key);
    add(svg, 'text', { x: 126, y: part.y + 32, class: 'anov-detail' }, `${show(part.start)} → ${show(part.end)}；差=${show(part.value)}`);
  }
  for (const tick of [0, 5, 10, 15, 20]) add(svg, 'text', { x: xPosition(tick), y: 313, 'text-anchor': 'middle', class: 'anov-tick' }, tick);
  add(svg, 'text', { x: 628, y: 313, class: 'anov-label' }, 'Y');
  svg.setAttribute('aria-label', `选中 ${row.id}；三个有方向的线段使用共同响应轴 −2 至 24。总偏差从 grand mean ${show(g)} 到观测 ${show(value)}，为 ${show(row.total)}；组间偏差从 ${show(g)} 到组均值 ${show(m)}，为 ${show(row.between)}；组内残差从 ${show(m)} 到 ${show(value)}，为 ${show(row.residual)}。${show(row.total)}=${show(row.between)}+(${show(row.residual)})。线段表示未平方的差，不表示平方和。`);
}

export function mountAnova(root) {
  if (root.dataset.anovaReady) return;
  root.classList.add('anov-lab');
  root.innerHTML = `<p>使用正文的同一份九点例子：默认 A=[4,5,6]、B=[7,8,9]、C=[10,11,12]。两个滑块直接构造样本值，不是从某个总体反复随机抽样。先固定一个滑块，再观察另一项进入哪一个平方和。</p>
    <div class="anov-controls"><label for="ag">组中心间距 gap：<output id="ag-v" data-anov-gap-value>3</output><input id="ag" data-anov-gap type="range" min="0" max="6" step="0.25" value="3"></label><label for="an">组内残差倍数 noise：<output id="an-v" data-anov-noise-value>1</output><input id="an" data-anov-noise type="range" min="0.25" max="5" step="0.25" value="1"></label></div>
    <button type="button" class="secondary" data-anov-reset>恢复正文九点例子</button><p class="anov-error" data-anov-error role="alert"></p><p class="anov-note" data-anov-settings role="status"></p>
    <div data-anov-results><figure><svg data-anov-plot="main" viewBox="0 0 680 355" role="img"></svg><figcaption>绿色点是观测；棕色短线是组均值；灰色虚线是 grand mean。圈出选中 ID，细点线追踪其 residual。同组点横向错开只为辨识，不是另一个测量变量。改变滑块保持同一坐标尺度。</figcaption></figure>
    <h3>选中一个观测，核对它对每一项的贡献</h3><p class="anov-note">点击行首 ID 追踪原始观测。t=Y−grand mean，b=group mean−grand mean，e=Y−group mean；这里 t 只是总偏差的简写，不是 t 检验统计量。后四列是平方与 cross-term，单位为响应单位的平方。窄屏请在表内横向滚动。</p>
    <div class="anov-table-wrap" tabindex="0" role="region" aria-label="九个观测的偏差与平方和贡献，可横向滚动"><table class="anov-observations"><thead><tr><th scope="col">ID</th><th scope="col">Y</th><th scope="col">t</th><th scope="col">b</th><th scope="col">e</th><th scope="col">t²</th><th scope="col">b²</th><th scope="col">e²</th><th scope="col">2be</th></tr></thead><tbody>${ids.map(id => `<tr data-anov-row="${id}"><th scope="row"><button type="button" class="secondary" data-anov-select="${id}" aria-pressed="false">${id}</button></th>${['value', 'total', 'between', 'residual', 'totalSquare', 'betweenSquare', 'residualSquare', 'cross'].map(key => `<td data-anov-cell="${id}-${key}"></td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th scope="row" colspan="5">逐行加总</th><td data-anov-sum="sst"></td><td data-anov-sum="ssb"></td><td data-anov-sum="sse"></td><td data-anov-sum="cross"></td></tr></tfoot></table></div>
    <p class="anov-readout" data-anov-selected aria-live="polite"></p>
    <figure><svg data-anov-decomposition="main" viewBox="0 0 680 345" role="img"></svg><figcaption>空心点是起点，箭头指向终点；重合时显示实点与“差=0”。三行共用响应轴，线段表示带方向的差，不能把线段长度直接当平方和。组间偏差是拟合组中心的描述，不自动等于真实处理效应或因果效应。</figcaption></figure>
    <details class="anov-enlarge"><summary>放大查看两张图</summary><div class="anov-large-wrap" tabindex="0" role="region" aria-label="放大的 ANOVA 观测图和有向偏差图，可横向滚动"><svg data-anov-plot="large" viewBox="0 0 680 355" role="img"></svg><svg data-anov-decomposition="large" viewBox="0 0 680 345" role="img"></svg></div></details>
    <h3>从逐项分解，到相加后的平方和</h3><div data-anov-group-sums></div><p class="anov-readout" data-anov-identity></p><p data-anov-grand></p>
    <h3>除以自由度，读完整 ANOVA 表</h3><p class="anov-note">表内可横向滚动；F 只填 treatment 行，分母来自 error 行的 MSE。Total 行不用来构造一个额外检验。</p><div class="anov-table-wrap" tabindex="0" role="region" aria-label="ANOVA 的平方和、自由度、均方、F 和 P，可横向滚动"><table class="anov-output"><thead><tr><th scope="col">来源</th><th scope="col">SS</th><th scope="col">df</th><th scope="col">MS</th><th scope="col">F</th><th scope="col">右尾 P</th></tr></thead><tbody>${['Treatment', 'Error', 'Total'].map((name, i) => `<tr><th scope="row">${name}</th>${['ss', 'df', 'ms', 'f', 'p'].map(key => `<td data-anov-output="${i}-${key}"></td>`).join('')}</tr>`).join('')}</tbody></table></div><p data-anov-conclusion></p></div>
    <details><summary>复制当前九点数据到 base R 核对</summary><button type="button" class="secondary" data-anov-copy>复制当前 R 代码</button><pre data-anov-code></pre><p class="anov-note" data-anov-copy-status role="status"></p></details>
    <p class="anov-note">这是每组 3 个独立实验单位的假设构造；重复测量同一单位不能充当这些独立行。精确 F 参考需要独立正态误差与共同 variance。P 小不代表 effect 大，也不是 H₀ 为真的概率；整体拒绝只说并非所有总体均值相等，不能直接指定哪些组不同。</p>`;
  const $ = selector => root.querySelector(selector), gapInput = $('[data-anov-gap]'), noiseInput = $('[data-anov-noise]'), copy = $('[data-anov-copy]');
  let selectedId = 'A1', result = null, revision = 0;
  function read() {
    const values = [gapInput.value.trim(), noiseInput.value.trim()];
    if (values.some(value => !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value))) throw Error('请设置有效的组中心间距与残差倍数。');
    return { gap: Number(values[0]), noise: Number(values[1]) };
  }
  function update() {
    revision++; $('[data-anov-copy-status]').textContent = '';
    try {
      result = anovaAnalysis(read()); const row = selectedRow(result, selectedId);
      gapInput.setAttribute('aria-invalid', 'false'); noiseInput.setAttribute('aria-invalid', 'false');
      $('[data-anov-error]').textContent = ''; $('[data-anov-results]').hidden = false; copy.disabled = false;
      $('[data-anov-gap-value]').textContent = show(result.gap); $('[data-anov-noise-value]').textContent = show(result.noise);
      $('[data-anov-settings]').textContent = `当前构造：组中心为 5、5+gap、5+2gap = ${result.groups.map(group => show(group.mean)).join('、')}；每组残差为 [−1,0,1]×${show(result.noise)}。N=9，每组 n=3。${result.gap === 0 ? 'gap=0 强制本次三个样本均值相同，因此 F=0、P=1；这不表示 H₀ 成立时所有随机样本都给出 F=0。' : ''}`;
      for (const size of ['main', 'large']) { drawAnova($(`[data-anov-plot="${size}"]`), result, selectedId); drawAnovaDecomposition($(`[data-anov-decomposition="${size}"]`), result, selectedId); }
      for (const item of result.rows) {
        const selected = item.id === selectedId, button = $(`[data-anov-select="${item.id}"]`);
        button.disabled = false; button.setAttribute('aria-pressed', String(selected)); $(`[data-anov-row="${item.id}"]`).setAttribute('data-selected', String(selected));
        for (const key of ['value', 'total', 'between', 'residual', 'totalSquare', 'betweenSquare', 'residualSquare', 'cross']) $(`[data-anov-cell="${item.id}-${key}"]`).textContent = show(item[key]);
      }
      for (const [key, value] of Object.entries({ sst: result.sst, ssb: result.ssb, sse: result.sse, cross: result.crossSum })) $(`[data-anov-sum="${key}"]`).textContent = show(value);
      $('[data-anov-selected]').textContent = `${row.id}：Y=${show(row.value)}，group mean=${show(row.groupMean)}，grand mean=${show(result.grandMean)}。总偏差 ${show(row.total)} = 组间 ${show(row.between)} + 组内 (${show(row.residual)})。平方后必须保留 cross-term：${show(row.totalSquare)} = ${show(row.betweenSquare)} + ${show(row.residualSquare)} + (${show(row.cross)})；该点的 cross-term 为 ${show(row.cross)}，不能未经求和就丢掉。`;
      $('[data-anov-group-sums]').innerHTML = result.groups.map(group => `<p><b>${group.group} 组：</b>组均值=${show(group.mean)}，每行的 b=${show(group.mean - result.grandMean)}；Σe=${show(group.residualSum)}，所以 Σ2be=2×(${show(group.mean - result.grandMean)})×0=${show(group.crossSum)}。本组贡献 SStrt=${show(group.ssb)}、SSE=${show(group.sse)}。</p>`).join('');
      $('[data-anov-identity]').textContent = `直接逐行求得 SST=${show(result.sst)}；SStrt=${show(result.ssb)}，SSE=${show(result.sse)}，Σcross=${show(result.crossSum)}。全部相加后：${show(result.sst)}=${show(result.ssb)}+${show(result.sse)}。每组 residual 和为 0，使 cross-term 总和抵消；不是每个观测都没有 cross-term。`;
      $('[data-anov-grand]').textContent = `Grand mean 使用全部观测：(${result.groups.map(group => `${group.n}×${show(group.mean)}`).join('+')})/${result.N}=${show(result.grandMean)}。本例每组 n 相同，才恰好等于三个组均值的简单平均；组大小不同时仍须按 n 加权。`;
      const output = [[result.ssb, result.dfBetween, result.msBetween, result.f, result.p], [result.sse, result.dfError, result.mse, null, null], [result.sst, result.dfTotal, null, null, null]];
      output.forEach((values, i) => ['ss', 'df', 'ms', 'f', 'p'].forEach((key, j) => $(`[data-anov-output="${i}-${key}"]`).textContent = values[j] === null ? '—' : show(values[j])));
      $('[data-anov-conclusion]').textContent = `F=MStrt/MSE=${show(result.msBetween)}/${show(result.mse)}=${show(result.f)}，参考 F(2,6) 的右尾 P=${show(result.p)}。在模型条件成立且预先取 α=.05 时，${result.p < .05 ? '该构造样本支持拒绝总体均值全相同；仍需具体比较才能回答哪些组不同。' : '该构造样本不足以拒绝总体均值全相同；这不是证明三个总体均值相等。'}`;
      $('[data-anov-code]').textContent = anovaRCode(result, selectedId);
    } catch (error) {
      result = null; gapInput.setAttribute('aria-invalid', 'true'); noiseInput.setAttribute('aria-invalid', 'true');
      $('[data-anov-error]').textContent = error.message + ' 当前不显示旧结果。'; $('[data-anov-results]').hidden = true; $('[data-anov-settings]').textContent = '等待有效设置；可恢复正文九点例子。';
      copy.disabled = true; $('[data-anov-code]').textContent = '';
      for (const size of ['main', 'large']) { drawAnova($(`[data-anov-plot="${size}"]`), null); drawAnovaDecomposition($(`[data-anov-decomposition="${size}"]`), null); }
      for (const id of ids) $(`[data-anov-select="${id}"]`).disabled = true;
    }
  }
  gapInput.addEventListener('input', update); noiseInput.addEventListener('input', update);
  for (const id of ids) $(`[data-anov-select="${id}"]`).addEventListener('click', () => { selectedId = id; update(); });
  $('[data-anov-reset]').addEventListener('click', () => { gapInput.value = '3'; noiseInput.value = '1'; selectedId = 'A1'; update(); });
  copy.addEventListener('click', async () => {
    if (!result) return; const version = revision, code = $('[data-anov-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-anov-copy-status]').textContent = '已复制当前九点数据、逐行分解与 ANOVA 核对代码。'; }
    catch { if (version === revision) $('[data-anov-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; }
  });
  update(); root.dataset.anovaReady = 'true';
}
