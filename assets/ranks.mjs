// Exhaustive, fixed teaching examples. Equal-valued observations retain identities.
function ranks(values) {
  return values.map(value => 1 + values.filter(x => x < value).length + (values.filter(x => x === value).length - 1) / 2);
}

export function rankExperiment(mode = 'rank-sum') {
  if (mode === 'rank-sum') {
    const values = [3, 4, 5, 5, 8, 9], scores = ranks(values), allocations = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 5; j++) for (let k = j + 1; k < 6; k++) {
      const selected = [i, j, k];
      allocations.push({ selected, statistic: selected.reduce((s, index) => s + scores[index], 0) });
    }
    return { mode, values, scores, allocations, observed: 8, center: 10.5,
      symbol: '原始 rank sum', assumptions: '在 H₀ 下，六个独立单位的组标签可交换（例如来自相同分布）；每次仍有三个 A、三个 B。这里只固定观测与组大小，重排标签。只声称 median 相等不足以保证这种可交换性。',
      observation: '原始 A 为 #1、#3、#4，即 [3,5,5]；B 为 #2、#5、#6，即 [4,8,9]。原始 rank sum=1+3.5+3.5=8；R 双样本输出 W=8−6=2。',
      counting: '六个观测保留各自编号；两个 5 分别是 #3 和 #4。C(6,3)=20 个等可能标签分配。相同的 rank sum 可以由不同分配得到，不能删去重复统计量后再等权计数。',
      link: 'chapters/06.html#rank-sum-ties-exact' };
  }
  if (mode === 'signed-rank') {
    const values = [-1, 2, 2, 3, 4], scores = ranks(values.map(Math.abs));
    const allocations = Array.from({ length: 32 }, (_, mask) => {
      const selected = scores.flatMap((_, i) => mask & (1 << i) ? [i] : []);
      return { selected, statistic: selected.reduce((s, i) => s + scores[i], 0) };
    });
    return { mode, values, scores, allocations, observed: 14, center: 7.5,
      symbol: 'W⁺（正差秩和）', assumptions: '先定义差值方向。本例 D=[0,−1,2,2,3,4]，采用删零后排名的 Wilcoxon 约定。在 H₀ 下，各独立差值关于 0 对称；给定非零绝对差，每个正负号等可能且相互独立。仅 median=0 而不对称时，不能自动使用此符号参考分布。',
      observation: '零差不参加排名。剩余五个差值为 [−1,2,2,3,4]；正差 ranks 为 2.5、2.5、4、5，W⁺=14，W⁻=1，SAS 中心化统计量 S=14−7.5=6.5。',
      counting: '非零差值 m=5，每个单位有正负两种符号，共 2⁵=32 种等可能分配。两个绝对差 2 仍是不同单位，各自保留一个符号。零差不增加一个可自由变号的单位，不能按 2⁶ 计数。',
      link: 'chapters/06.html#signed-rank-zero-ties' };
  }
  throw new RangeError('Unknown rank experiment');
}

export function rankTail(experiment, tail = 'less') {
  if (!['less', 'greater', 'two'].includes(tail)) throw new RangeError('Unknown tail');
  const includes = x => tail === 'less' ? x <= experiment.observed : tail === 'greater' ? x >= experiment.observed : Math.abs(x - experiment.center) >= Math.abs(experiment.observed - experiment.center);
  const included = experiment.allocations.map(a => includes(a.statistic));
  const count = included.filter(Boolean).length;
  return { included, count, probability: count / included.length };
}

export function rankHistogram(experiment) {
  const counts = new Map();
  for (const a of experiment.allocations) counts.set(a.statistic, (counts.get(a.statistic) || 0) + 1);
  return [...counts].sort(([a], [b]) => a - b).map(([statistic, count]) => ({ statistic, count }));
}

const display = n => Number.isInteger(n) ? String(n) : n.toFixed(1);

export function mountRankLab(el) {
  el.classList.add('wbench');
  el.innerHTML = `<div class="wbench-controls"><label>实验结构<select data-rank-mode><option value="rank-sum">两个独立样本 · 重排组标签</option><option value="signed-rank">配对差值 · 重排正负号</option></select></label><label>事先规定的检验方向<select data-rank-tail><option value="less">左尾</option><option value="greater">右尾</option><option value="two">双侧 · 离中心至少同样远</option></select></label></div>
    <p data-rank-assumptions class="wbench-assumptions"></p><p data-rank-observed></p><p data-rank-counting></p>
    <div data-rank-data></div><div data-rank-result class="wbench-result"></div>
    <figure class="rank-figure"><svg viewBox="0 0 660 270" role="img" aria-label="完整精确参考分布；柱高是分配数，斜纹是所选检验尾部"></svg><figcaption>每根柱合并相同统计量的分配。斜纹与褐色表示进入尾部；虚线标出固定的观测统计量，粗边框标出当前查看的分配。</figcaption></figure>
    <div class="wbench-controls"><label class="rank-range">逐个查看 H₀ 下的分配 <output data-rank-index></output><input data-rank-step type="range" min="1" max="20" value="1" step="1"></label></div>
    <div class="wbench-actions"><button type="button" data-rank-prev>上一个</button><button type="button" data-rank-next>下一个</button><button type="button" data-rank-play>播放分配</button><button type="button" data-rank-reset class="secondary">回到第 1 个</button></div>
    <p data-rank-current></p><p data-rank-status class="wbench-progress" role="status"></p><div data-rank-allocations class="rank-allocations" role="group" aria-label="选择一个分配查看"></div>
    <p class="wbench-note">移动滑块只浏览 H₀ 的参考分配，原始观测阈值和 P 值保持不变。换检验方向是比较规则的教学操作，实际分析应在看结果前规定方向。本实验穷举全部分配，没有 Monte Carlo 抽样误差。</p>
    <details><summary>逐项核对参考分布的计数</summary><div data-rank-frequency></div></details><p data-rank-link></p>`;
  const $ = selector => el.querySelector(selector);
  let mode = 'rank-sum', experiment = rankExperiment(mode), index = 0, timer = null;
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const stop = (message = '') => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    $('[data-rank-play]').textContent = '播放分配';
    $('[data-rank-play]').setAttribute('aria-pressed', 'false');
    if (message) $('[data-rank-status]').textContent = message;
  };
  function draw() {
    const tail = $('[data-rank-tail]').value, result = rankTail(experiment, tail), bins = rankHistogram(experiment);
    const total = experiment.allocations.length, current = experiment.allocations[index];
    $('[data-rank-step]').max = String(total); $('[data-rank-step]').value = String(index + 1);
    $('[data-rank-index]').textContent = `${index + 1} / ${total}`;
    $('[data-rank-prev]').disabled = index === 0; $('[data-rank-next]').disabled = index === total - 1;
    const tailRule = tail === 'less' ? `W ≤ ${experiment.observed}` : tail === 'greater' ? `W ≥ ${experiment.observed}` : `|W−${experiment.center}| ≥ ${Math.abs(experiment.observed - experiment.center)}`;
    $('[data-rank-result]').innerHTML = `<strong>精确 P = ${result.count} / ${total} = ${result.probability.toFixed(4)}</strong><span>固定观测 ${experiment.symbol} = ${experiment.observed}；H₀ 中心 = ${experiment.center}。</span><span>计数规则：${tailRule}，包含等号。本例的条件分布对称；双侧计入两边同样远或更远的结果。</span>`;
    const membership = mode === 'rank-sum'
      ? `A={${current.selected.map(i => '#' + (i + 1)).join('、')}}；B={${experiment.values.flatMap((_, i) => current.selected.includes(i) ? [] : ['#' + (i + 1)]).join('、')}}`
      : `当前非零差值符号：[${experiment.values.map((v, i) => (current.selected.includes(i) ? '+' : '−') + Math.abs(v)).join(', ')}]`;
    $('[data-rank-current]').textContent = `分配 ${index + 1}/${total}：${membership}；${experiment.symbol}=${display(current.statistic)}，${result.included[index] ? '计入' : '不计入'}当前检验的尾部。`;
    const allocationBox = $('[data-rank-allocations]');
    if (allocationBox.children.length !== total) allocationBox.innerHTML = experiment.allocations.map((a, i) => `<button type="button" data-allocation="${i}">#${String(i + 1).padStart(2, '0')} · W=${display(a.statistic)}<span></span></button>`).join('');
    allocationBox.querySelectorAll('button').forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === index));
      button.classList.toggle('rank-tail', result.included[i]);
      button.querySelector('span').textContent = result.included[i] ? '尾部 ✓' : '非尾部';
    });
    const maxCount = Math.max(...bins.map(b => b.count));
    const minimum = Math.floor(bins[0].statistic), maximum = Math.ceil(bins.at(-1).statistic);
    const xMap = value => 66 + (value - minimum + .5) / (maximum - minimum + 1) * 530;
    const minGap = Math.min(...bins.slice(1).map((b, i) => b.statistic - bins[i].statistic));
    const barWidth = (xMap(minGap) - xMap(0)) * .72;
    let svg = '<defs><pattern id="rank-tail-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 6L6 0M5 7L7 5" stroke="#9a472e" stroke-width="1"/></pattern></defs><path d="M60 30V220H610" fill="none" stroke="#698077"/><text x="60" y="20" class="rank-chart-label">分配数</text><text x="610" y="257" text-anchor="end" class="rank-chart-label">W</text>';
    for (let n = 0; n <= maxCount; n++) svg += `<text x="48" y="${224 - n / maxCount * 165}" text-anchor="end" class="rank-chart-label">${n}</text>`;
    for (let tick = minimum; tick <= maximum; tick += 3) svg += `<text x="${xMap(tick)}" y="243" text-anchor="middle" class="rank-chart-label">${tick}</text>`;
    bins.forEach(b => {
      const x = xMap(b.statistic) - barWidth / 2, h = b.count / maxCount * 165, y = 220 - h;
      const inTail = result.included[experiment.allocations.findIndex(a => a.statistic === b.statistic)];
      const selected = b.statistic === current.statistic, observed = b.statistic === experiment.observed;
      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="${inTail ? '#f7e5da' : '#c5ded4'}" stroke="#183a37" stroke-width="${selected ? 3.5 : .7}"><title>W=${display(b.statistic)}；${b.count} 个分配；${inTail ? '进入尾部' : '不在尾部'}</title></rect>`;
      if (inTail) svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="url(#rank-tail-hatch)"/>`;
      if (observed) svg += `<path d="M${xMap(b.statistic)} 30V220" stroke="#9a472e" stroke-width="2" stroke-dasharray="5 4"/>`;
    });
    $('svg').innerHTML = svg;
    $('svg').setAttribute('aria-label', `${experiment.symbol}完整参考分布；${result.count}/${total} 个分配进入尾部；当前 W=${display(current.statistic)}。详细计数见下方表格。`);
    const frequency = $('[data-rank-frequency]'), frequencyKey = `${mode}/${tail}`;
    if (frequency.dataset.key !== frequencyKey) {
      frequency.innerHTML = `<div class="table-scroll" tabindex="0" role="region" aria-label="秩统计量频数表，可横向滚动"><table><thead><tr><th>W</th><th>分配数</th><th>条件概率</th><th>当前尾部</th></tr></thead><tbody>${bins.map(b => `<tr><td>${display(b.statistic)}</td><td>${b.count}</td><td>${b.count}/${total}</td><td>${result.included[experiment.allocations.findIndex(a => a.statistic === b.statistic)] ? '是' : '否'}</td></tr>`).join('')}</tbody></table></div>`;
      frequency.dataset.key = frequencyKey;
    }
  }
  function changeMode() {
    stop(); mode = $('[data-rank-mode]').value; experiment = rankExperiment(mode); index = 0;
    $('[data-rank-tail]').value = mode === 'rank-sum' ? 'less' : 'two';
    $('[data-rank-assumptions]').textContent = experiment.assumptions;
    $('[data-rank-observed]').textContent = experiment.observation;
    $('[data-rank-counting]').textContent = experiment.counting;
    $('[data-rank-data]').innerHTML = `<div class="rank-observations">${experiment.values.map((v, i) => `<div><b>#${i + 1}</b><span>${mode === 'rank-sum' ? '观测' : '非零 D'} ${v}</span><span>rank ${display(experiment.scores[i])}</span></div>`).join('')}</div>`;
    $('[data-rank-link]').innerHTML = `<a href="${experiment.link}">连接手算、近似 P 值与可运行 R 代码 →</a>`;
    $('[data-rank-status]').textContent = motion?.matches ? '当前系统偏好减少动态，可用滑块与按钮逐个查看。' : '手动开始播放；也可以直接选择下方分配。';
    draw();
  }
  const move = next => { stop(); index = Math.max(0, Math.min(experiment.allocations.length - 1, next)); draw(); $('[data-rank-status]').textContent = `正在查看第 ${index + 1} 个分配。`; };
  $('[data-rank-mode]').addEventListener('change', changeMode);
  $('[data-rank-tail]').addEventListener('change', () => { stop(); draw(); $('[data-rank-status]').textContent = '检验方向已改变；观测阈值保持固定。'; });
  $('[data-rank-step]').addEventListener('input', event => move(Number(event.target.value) - 1));
  $('[data-rank-prev]').addEventListener('click', () => move(index - 1));
  $('[data-rank-next]').addEventListener('click', () => move(index + 1));
  $('[data-rank-reset]').addEventListener('click', () => move(0));
  $('[data-rank-allocations]').addEventListener('click', event => { const button = event.target.closest('[data-allocation]'); if (button) move(Number(button.dataset.allocation)); });
  $('[data-rank-play]').addEventListener('click', () => {
    if (timer !== null) { stop('已暂停；可以继续手动查看。'); return; }
    if (motion?.matches) return;
    if (index === experiment.allocations.length - 1) index = 0;
    draw(); $('[data-rank-play]').textContent = '暂停'; $('[data-rank-play]').setAttribute('aria-pressed', 'true');
    $('[data-rank-status]').textContent = '正在逐个查看全部分配；到最后一个自动停止。';
    timer = setInterval(() => { index++; draw(); if (index === experiment.allocations.length - 1) stop('已经到达最后一个分配。'); }, 1000);
  });
  const updateMotion = () => { $('[data-rank-play]').disabled = Boolean(motion?.matches); if (motion?.matches) stop('减少动态已启用；请手动查看。'); };
  motion?.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('页面离开前台，演示已暂停。'); });
  if (typeof IntersectionObserver === 'function') new IntersectionObserver(entries => { if (!entries[0].isIntersecting && timer !== null) stop('实验离开视野，演示已暂停。'); }).observe(el);
  changeMode(); updateMotion(); el.dataset.ready = 'true';
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-rank-lab]').forEach(mountRankLab);
