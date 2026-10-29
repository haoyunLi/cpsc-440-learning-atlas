import { parseSample } from './sample.mjs';

const modes = {
  identity: { name: '不变换：T = Y', forward: y => y, inverse: t => t, r: 'y' },
  sqrt: { name: 'T = √Y', forward: Math.sqrt, inverse: t => t * t, shift: 0, r: 'sqrt(y)' },
  shifted: { name: 'T = √(Y + 3/8)', forward: y => Math.sqrt(y + 3 / 8), inverse: t => t * t - 3 / 8, shift: 3 / 8, r: 'sqrt(y + 3/8)' },
  log: { name: 'T = log(Y)', forward: Math.log, inverse: Math.exp, r: 'log(y)' }
};
const mean = values => values[0] + values.reduce((sum, v) => sum + (v - values[0]), 0) / values.length;
const variance = values => { const center = mean(values); return values.reduce((sum, v) => sum + (v - center) ** 2, 0) / (values.length - 1); };
const format = (value, spread) => {
  if (value === 0) return '0';
  const digits = spread > 0 ? Math.min(17, Math.max(8, Math.floor(Math.log10(Math.abs(value))) - Math.floor(Math.log10(spread)) + 6)) : 8;
  return Number(value.toPrecision(digits)).toString();
};

export function transformationSummary(values, mode = 'shifted') {
  if (!Object.hasOwn(modes, mode)) throw Error('请选择不变换、平方根、平方根加 3/8 或自然对数。');
  if (!Array.isArray(values) || values.length < 2 || values.length > 80 || values.some(y => !Number.isFinite(y) || y < 0 || y > 1e6 || (y > 0 && y < 1e-8))) throw Error('本实验接受 2–80 个非负观测；非零值范围为 1e-8 到 1e6。');
  if (mode === 'log' && values.some(y => y === 0)) throw Error('log(Y) 要求每个 Y > 0。请查看零值的来源或选择其他尺度；本实验不会自动加常数。');
  const spec = modes[mode], transformed = values.map(spec.forward), rawMean = mean(values), constant = values.every(v => v === values[0]);
  // Rationalize sqrt differences before computing their variance. Subtracting
  // two nearly equal roots would lose the very dispersion this lab explains.
  const offsets = spec.shift === undefined ? transformed : values.map((y, i) => y === values[0] ? 0 : (y - values[0]) / (transformed[i] + transformed[0]));
  const transformedMean = spec.shift === undefined ? mean(transformed) : transformed[0] + mean(offsets);
  const transformedVariance = variance(offsets);
  const squareCorrection = spec.shift === undefined ? null : (values.length - 1) / values.length * transformedVariance;
  const backCenter = constant ? values[0] : squareCorrection === null ? spec.inverse(transformedMean) : rawMean - squareCorrection;
  const directGap = rawMean - backCenter;
  const gapLimited = mode === 'log' && !constant && Math.abs(directGap) < 64 * Number.EPSILON * rawMean;
  const gap = squareCorrection === null ? gapLimited ? null : directGap : squareCorrection;
  return { n: values.length, mode, name: spec.name, values: [...values], transformed, rawMean, transformedMean, transformedVariance, backCenter, gap, gapLimited, squareCorrection,
    ratio: backCenter > 0 ? rawMean / backCenter : null };
}

export function transformationRCode(values, mode) {
  transformationSummary(values, mode);
  const spec = modes[mode];
  const inverse = mode === 'log' ? 'exp(mean(t))' : mode === 'identity' ? 'mean(t)' : `mean(t)^2 - ${spec.shift}`;
  const stableGap = spec.shift !== undefined ? `# Rationalized differences equal t - t[1] but avoid cancellation.
t_offsets <- ifelse(y == y[1], 0, (y-y[1])/(t+t[1]))
correction <- (length(y)-1)/length(y)*var(t_offsets)
back_center <- mean(y)-correction
gap <- correction
` : mode === 'log' ? `# A tiny difference between nearly equal means may be below floating-point resolution.
gap <- mean(y)-back_center
if (length(unique(y)) == 1) { back_center <- mean(y); gap <- 0 }
if (length(unique(y)) > 1 && abs(gap) < 64*.Machine$double.eps*mean(y)) {
  gap <- NA_real_
  message("Gap is below floating-point resolution; do not interpret cancellation noise.")
}
` : 'gap <- 0\n';
  return `# Descriptive comparison of two orders of operations; no normality assumption.
y <- c(${values.join(', ')})
t <- ${spec.r}
back_center <- ${inverse}
${stableGap}
print(data.frame(observation=seq_along(y), y=y, transformed=t), digits=15)
print(c(n=length(y), arithmetic_mean=mean(y), mean_transformed=mean(t),
        back_transformed_center=back_center, gap=gap), digits=15)
${spec.shift !== undefined ? `# Recover the arithmetic sample mean using its second moment.
recovered <- mean(t)^2 + correction - ${spec.shift}
print(c(sample_variance_transformed=var(t_offsets), recovered_arithmetic_mean=recovered))
stopifnot(isTRUE(all.equal(recovered, mean(y), tolerance=1e-7)))
` : mode === 'log' ? '# exp(mean(log(y))) is the sample geometric mean, not the arithmetic mean.\n' : ''}# These are sample summaries, not population confidence intervals.
`;
}

// Coordinates use differences before adding an offset, preserving local detail.
export function transformationAxis(values) {
  const min = Math.min(...values), max = Math.max(...values), range = max - min;
  const padding = range ? range * .12 : Math.max(Math.abs(min) * .1, .1);
  const span = range + 2 * padding, offset = Math.abs(min) / span >= 1000 ? min : 0;
  const start = min - offset - padding, end = max - offset + padding;
  const magnitude = Math.max(Math.abs(start), Math.abs(end));
  const exponent = magnitude >= 1e5 || magnitude < .01 ? Math.floor(Math.log10(magnitude)) : 0;
  const unit = 10 ** exponent;
  return { position: value => (value - min + padding) / span, offset, exponent,
    ticks: [0, .5, 1].map(position => ({ position, label: Number(((start + (end - start) * position) / unit).toPrecision(5)).toString() })) };
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, type, attributes, text = '') {
  const el = document.createElementNS(ns, type);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
  el.textContent = text; svg.append(el); return el;
}
function draw(root, kind, values, centers, selected, symbol) {
  const svg = root.querySelector(`[data-transform-${kind}]`), axis = transformationAxis(values), x = v => 54 + 572 * axis.position(v);
  svg.replaceChildren();
  add(svg, 'line', { x1: 54, x2: 626, y1: 150, y2: 150, class: 'wbench-axis' });
  axis.ticks.forEach((tick, i) => {
    const px = 54 + 572 * tick.position;
    add(svg, 'line', { x1: px, x2: px, y1: 150, y2: 156, class: 'wbench-axis' });
    add(svg, 'text', { x: px, y: 181, 'text-anchor': ['start', 'middle', 'end'][i], class: 'transform-tick' }, tick.label);
  });
  centers.forEach(({ value, back }) => {
    add(svg, 'line', { x1: x(value), x2: x(value), y1: 32, y2: 150, stroke: back ? '#9a472e' : '#183a37', 'stroke-width': 2, 'stroke-dasharray': back ? '6 5' : '' });
    if (back) add(svg, 'path', { d: `M${x(value)-6},24 L${x(value)+6},24 L${x(value)},33 Z`, fill: '#9a472e' });
    else add(svg, 'rect', { x: x(value)-4, y: 24, width: 8, height: 8, fill: '#183a37' });
  });
  values.forEach((value, i) => add(svg, 'circle', { cx: x(value), cy: 70 + (i % 5) * 13, r: i === selected ? 7 : 4, fill: i === selected ? '#9a472e' : '#086f68', stroke: i === selected ? '#183a37' : 'none', 'stroke-width': 2 }));
  const note = axis.offset ? `${symbol} = ${String(axis.offset)} + 刻度${axis.exponent ? ` × 1e${axis.exponent}` : ''}` : axis.exponent ? `${symbol} = 刻度 × 1e${axis.exponent}` : `${symbol} 轴使用实际数值`;
  root.querySelector(`[data-transform-${kind}-scale]`).textContent = note;
  svg.setAttribute('aria-label', `${symbol} 的 ${values.length} 个观测。选中第 ${selected + 1} 个，值 ${format(values[selected])}。${note}。`);
}

export function mountTransformation(root) {
  if (root.dataset.ready) return;
  root.classList.add('wbench');
  root.innerHTML = `<h2>先求均值，还是先变换？</h2><p>在同一份数据上比较两条计算路径。先预测两者是否相等，再改变一个观测；橙色描边点始终对应同一条记录。</p>
<div class="wbench-controls"><label>选择教学数据<select data-transform-preset><option value="square">平方根例：等距的 T</option><option value="log">对数例：等距的 log(Y)</option><option value="outlier">一个很大的观测</option><option value="constant">所有观测相同</option><option value="zeros">包含零的计数</option><option value="custom">自行编辑</option></select></label><label>变换尺度<select data-transform-mode>${Object.entries(modes).map(([key, spec]) => `<option value="${key}"${key === 'shifted' ? ' selected' : ''}>${spec.name}</option>`).join('')}</select></label><label class="transform-data">原始观测 Y（2–80 个非负值，逗号或空格分隔）<textarea data-transform-values>.625, 3.625, 8.625, 15.625, 24.625</textarea></label><label>追踪第 <output data-transform-index-label>1</output> 个观测<input data-transform-index type="range" min="1" max="5" step="1" value="1"></label></div>
<p class="wbench-note">为保持计算与显示精度，本实验的非零输入范围为 1e-8 到 1e6。自然对数 log(Y) 需要 Y > 0；平方根示例限定非负响应。</p><p class="wbench-error" role="alert"></p><p data-transform-point class="wbench-progress" aria-live="polite"></p>
<div class="transform-plots"><figure><figcaption><b>原尺度 Y</b>：实线方标记为 arithmetic sample mean；虚线三角标记为变换后中心的回变换。两者相等时标记重合。</figcaption><svg data-transform-raw viewBox="0 0 680 205" role="img"></svg><p data-transform-raw-scale class="wbench-note"></p></figure><figure><figcaption><b>变换尺度 T</b>：实线为 mean(T)。两张图各自缩放，不能用像素长度直接比较 spread。点的竖向错开只为避免重叠。</figcaption><svg data-transform-changed viewBox="0 0 680 205" role="img"></svg><p data-transform-changed-scale class="wbench-note"></p></figure></div>
<div class="wbench-result" aria-live="polite"></div><p data-transform-explanation></p><p class="wbench-note">这里只比较样本摘要。图形变得对称，不证明残差满足 normality；也不能直接把回变换中心标为总体 arithmetic mean 的置信区间。<a href="chapters/08.html#transform">查看变换、二阶矩与 lognormal 区间的完整讲解 →</a></p>
<details><summary>把当前数据和计算带到 R</summary><button data-transform-copy type="button" class="secondary">复制当前 R 代码</button><p data-transform-copy-status class="status" role="status"></p><pre class="wbench-code" data-transform-code></pre></details>`;
  const data = root.querySelector('[data-transform-values]'), mode = root.querySelector('[data-transform-mode]'), index = root.querySelector('[data-transform-index]'), preset = root.querySelector('[data-transform-preset]');
  const presets = { square: { values: [.625, 3.625, 8.625, 15.625, 24.625], mode: 'shifted' }, log: { values: [1.6, 1.8, 2, 2.2, 2.4, 2.6].map(Math.exp), mode: 'log' }, outlier: { values: [2, 3, 3, 4, 40], mode: 'log' }, constant: { values: [4, 4, 4, 4, 4], mode: mode.value }, zeros: { values: [0, 0, 1, 2, 5, 9], mode: 'shifted' } };
  function render() {
    const result = root.querySelector('.wbench-result'), error = root.querySelector('.wbench-error'), code = root.querySelector('[data-transform-code]'), explanation = root.querySelector('[data-transform-explanation]');
    root.querySelector('[data-transform-copy-status]').textContent = '';
    try {
      let values;
      try { values = parseSample(data.value); } catch (err) { throw Error(err.message.replace('2–500', '2–80')); }
      const r = transformationSummary(values, mode.value);
      index.max = r.n; index.value = Math.min(Math.max(1, +index.value), r.n); index.disabled = false;
      const selected = +index.value - 1;
      const rawSpread = Math.max(...r.values) - Math.min(...r.values), transformedSpread = Math.max(...r.transformed) - Math.min(...r.transformed);
      const rawText = format(r.rawMean, rawSpread), backText = format(r.backCenter, rawSpread);
      root.querySelector('[data-transform-index-label]').textContent = selected + 1;
      root.querySelector('[data-transform-point]').textContent = `第 ${selected + 1} 个：Y = ${format(r.values[selected], rawSpread)} → T = ${format(r.transformed[selected], transformedSpread)}。没有删除或重新配对任何观测。`;
      draw(root, 'raw', r.values, [{ value: r.rawMean, back: false }, { value: r.backCenter, back: true }], selected, 'Y');
      draw(root, 'changed', r.transformed, [{ value: r.transformedMean, back: false }], selected, 'T');
      const gapText = r.gapLimited ? '低于浮点计算可分辨范围（约 0）' : format(r.gap);
      const nearlyEqual = r.gapLimited || (r.gap > 0 && rawText === backText);
      result.innerHTML = `<strong>原始 arithmetic mean = ${rawText}</strong><span>mean(T) = ${format(r.transformedMean, transformedSpread)}；回变换中心 ${nearlyEqual ? '≈' : '='} ${backText}</span><span>两者之差 = ${gapText}${r.ratio === null ? '' : `；arithmetic mean / 回变换中心 ${nearlyEqual ? '≈' : '='} ${format(r.ratio)}`}</span>${nearlyEqual ? '<span>两个中心在当前精度下近似重合。平方根模式用方差恒等式单独计算差值，避免直接相减丢失精度；对数模式不把无法分辨的舍入残差解释为数学差异。</span>' : ''}`;
      explanation.textContent = r.mode === 'log' ? `exp(mean(log(Y))) = ${format(r.backCenter)} 是当前样本的 geometric mean。正数据的 arithmetic mean ≥ geometric mean，相等仅当所有值相同；这项样本关系不需要 lognormal 假设。要解释为总体 median，需要额外的分布条件。` : r.squareCorrection === null ? '不变换时，两条计算路径相同：mean(Y) 就是 mean(T)。改变尺度后则要重新辨认估计对象。' : `mean(Y) = mean(T)² + [(n−1)/n]sT² − ${modes[r.mode].shift}。当前 sT² = ${format(r.transformedVariance)}；被直接回变换丢掉的分散项是 ${format(r.squareCorrection)}。把它加回去，才恢复当前样本的 arithmetic mean。`;
      code.textContent = transformationRCode(r.values, r.mode); error.textContent = ''; root.querySelector('[data-transform-copy]').disabled = false;
    } catch (err) {
      error.textContent = err.message; result.textContent = '等待有效数据。'; explanation.textContent = ''; code.textContent = ''; index.disabled = true;
      root.querySelectorAll('svg').forEach(svg => svg.replaceChildren());
      for (const selector of ['[data-transform-point]', '[data-transform-raw-scale]', '[data-transform-changed-scale]']) root.querySelector(selector).textContent = '';
      root.querySelector('[data-transform-copy]').disabled = true;
    }
  }
  preset.addEventListener('change', () => { if (preset.value !== 'custom') { const selected = presets[preset.value]; data.value = selected.values.join(', '); if (preset.value !== 'constant') mode.value = selected.mode; index.value = 1; } render(); });
  data.addEventListener('input', () => { preset.value = 'custom'; render(); });
  mode.addEventListener('change', render); index.addEventListener('input', render);
  root.querySelector('[data-transform-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(root.querySelector('[data-transform-code]').textContent); root.querySelector('[data-transform-copy-status]').textContent = '已复制当前数据的完整 R 代码。'; }
    catch { root.querySelector('[data-transform-copy-status]').textContent = '浏览器未允许复制，请直接选择下方代码手动复制。'; }
  });
  render(); root.dataset.ready = 'true';
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-transformation-lab]').forEach(mountTransformation);
