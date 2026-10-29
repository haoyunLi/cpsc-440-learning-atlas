const defaults = [[4, 5, 6], [7, 8, 9], [10, 11, 12]];
const tiedExample = [[1, 1, 2], [2, 3, 4], [4, 5, 5]];
const groupNames = ['A', 'B', 'C'];
const show = value => Number(value.toFixed(8)).toString();
const choicesOfThree = indices => {
  const choices = [];
  for (let i = 0; i < indices.length - 2; i++) for (let j = i + 1; j < indices.length - 1; j++) for (let k = j + 1; k < indices.length; k++) choices.push([indices[i], indices[j], indices[k]]);
  return choices;
};
const indices = Array.from({ length: 9 }, (_, i) => i);
const labelAllocations = choicesOfThree(indices).flatMap(a => {
  const remaining = indices.filter(i => !a.includes(i));
  return choicesOfThree(remaining).map(b => [a, b, remaining.filter(i => !b.includes(i))]);
});

export function parseKruskalValue(raw) {
  const text = String(raw).trim(), value = Number(text);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(value) || Math.abs(value) > 1e6) throw Error('九个观测都须为有限数字，绝对值不超过 1e6；空格不是 0。');
  if (value === 0 && /[1-9]/.test(text.split(/[eE]/)[0])) throw Error('非零数值超出浮点精度下限，不能自动当成 0；请换用更大的计量单位。');
  return value;
}

export function kruskalAnalysis(groups) {
  if (!Array.isArray(groups) || groups.length !== 3 || groups.some(group => !Array.isArray(group) || group.length !== 3 || group.some(value => !Number.isFinite(value) || Math.abs(value) > 1e6))) throw Error('请输入 A、B、C 三组，每组恰好三个有限观测，绝对值不超过 1e6。');
  const values = groups.flat(), ordered = indices.map(i => ({ index: i, value: values[i] })).sort((a, b) => a.value - b.value || a.index - b.index);
  const scores = Array(9), ties = [];
  for (let start = 0; start < 9;) {
    let end = start + 1; while (end < 9 && ordered[end].value === ordered[start].value) end++;
    const rank = (start + 1 + end) / 2;
    for (let i = start; i < end; i++) scores[ordered[i].index] = rank;
    if (end - start > 1) ties.push({ value: ordered[start].value, size: end - start, rank });
    start = end;
  }
  const rows = ordered.map(row => ({ ...row, id: `${groupNames[Math.floor(row.index / 3)]}${row.index % 3 + 1}`, group: groupNames[Math.floor(row.index / 3)], rank: scores[row.index] }));
  const rankSums = [0, 1, 2].map(group => scores.slice(3 * group, 3 * group + 3).reduce((a, b) => a + b, 0));
  const tieSum = ties.reduce((total, tie) => total + tie.size ** 3 - tie.size, 0), correction = 1 - tieSum / 720;
  const observedScore = rankSums.reduce((total, rankSum) => total + (2 * rankSum) ** 2, 0);
  const rawH = (observedScore - 2700) / 90;
  if (correction === 0) return { groups: groups.map(group => [...group]), values, scores, rows, rankSums, ties, tieSum, correction, rawH, h: null, approximateP: null, exactP: null, observedScore, informative: false, allocations: [], frequencies: [], tailCount: 0, total: 1680 };
  // Doubled average ranks and their group sums are integers. C and n=3 stay
  // fixed over allocations, so this integer score gives an exact >= tail rule.
  const hFromScore = score => (score - 2700) * 8 / (720 - tieSum), h = hFromScore(observedScore);
  const allocations = labelAllocations.map(members => {
    const doubledSums = members.map(group => group.reduce((total, i) => total + 2 * scores[i], 0));
    const score = doubledSums.reduce((total, rankSum) => total + rankSum ** 2, 0);
    return { members: members.map(group => [...group]), rankSums: doubledSums.map(value => value / 2), score, h: hFromScore(score), inTail: score >= observedScore };
  });
  const counts = new Map();
  for (const allocation of allocations) counts.set(allocation.score, (counts.get(allocation.score) || 0) + 1);
  const frequencies = [...counts].sort(([a], [b]) => a - b).map(([score, count]) => ({ score, h: hFromScore(score), count, inTail: score >= observedScore }));
  const tailCount = allocations.filter(allocation => allocation.inTail).length;
  // For df=2 the chi-square right tail has the closed form exp(-H/2).
  return { groups: groups.map(group => [...group]), values, scores, rows, rankSums, ties, tieSum, correction, rawH, h, approximateP: Math.exp(-h / 2), exactP: tailCount / allocations.length,
    observedScore, informative: true, allocations, frequencies, tailCount, total: allocations.length };
}

function rLiteral(value) {
  if (Number.isInteger(value)) return String(value);
  const bytes = new DataView(new ArrayBuffer(8)); bytes.setFloat64(0, value, false);
  const bits = bytes.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n);
  const fraction = (bits & ((1n << 52n) - 1n)).toString(16).padStart(13, '0');
  return `${value < 0 ? '-' : ''}0x${exponent ? '1' : '0'}.${fraction}p${exponent ? exponent - 1023 : -1022}`;
}

export function kruskalRCode(groups) {
  const r = kruskalAnalysis(groups);
  if (!r.informative) throw Error('全部观测相同，C=0；没有可用于比较的秩差异。');
  return `# Current observations keep their identities, including equal-valued units.
# Decimal display: ${groups.map((group, i) => `${groupNames[i]}=[${group.join(', ')}]`).join('; ')}
# Fractional values use exact hexadecimal floating-point literals so R's
# decimal parser cannot create artificial ties between adjacent doubles.
groups <- list(A=c(${groups[0].map(rLiteral).join(', ')}),B=c(${groups[1].map(rLiteral).join(', ')}),C=c(${groups[2].map(rLiteral).join(', ')}))
y <- unlist(groups,use.names=FALSE)
original_group <- rep(c("A","B","C"),each=3)
r <- rank(y,ties.method="average")
# Compare the numeric values directly; table(y) may merge nearby doubles
# when converting their values to character labels.
tie_sizes <- rle(sort(y))$lengths
C <- 1-sum(tie_sizes^3-tie_sizes)/(length(y)^3-length(y))
stopifnot(C>0)
observed_sums <- as.numeric(tapply(r,original_group,sum))
observed_score <- sum((2*observed_sums)^2)
H_raw <- 12/(9*10)*sum(observed_sums^2/3)-3*10
H <- H_raw/C
print(data.frame(id=paste0(original_group,rep(1:3,3)),y=y,rank=r),digits=17)
print(c(rank_sums=observed_sums,C=C,H_raw=H_raw,H=H))
# R's test uses table(x) for ties; formatting may merge very close raw values.
# Applying the test to pooled ranks preserves their order and exact tie groups.
# kruskal.test still uses the asymptotic chi-square reference, not enumeration.
print(kruskal.test(split(r,original_group)))
all_indices <- seq_along(y)
scores <- numeric(1680)
index <- 0L
for (a in combn(all_indices,3,simplify=FALSE)) {
  remaining <- setdiff(all_indices,a)
  for (b in combn(remaining,3,simplify=FALSE)) {
    cc <- setdiff(remaining,b)
    index <- index+1L
    sums <- c(sum(r[a]),sum(r[b]),sum(r[cc]))
    scores[index] <- sum((2*sums)^2)
  }
}
stopifnot(index==1680L)
# The integer score orders H exactly: equal group sizes and C are fixed.
tail_count <- sum(scores>=observed_score)
p_exact <- tail_count/length(scores)
p_approx <- pchisq(H,df=2,lower.tail=FALSE)
print(c(H=H,df=2,chi_square_p=p_approx,tail_count=tail_count,
        assignments=length(scores),exact_right_tail_p=p_exact))
H_reference <- (scores-2700)*8/(720-sum(tie_sizes^3-tie_sizes))
print(table(H_reference))
# Conditional exactness requires exchangeable group labels under the null.
# All 3/3/3 assignments of the nine distinct units are equally weighted.
# This is a nondirectional omnibus rank test, not a population-mean test.
# With equal distributional shapes, a location-shift interpretation may apply.`;
}

const ns = 'http://www.w3.org/2000/svg';
let patternCounter = 0;
function add(svg, tag, attrs, text = '') {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
export function drawKruskal(svg, result, index = 0) {
  svg.replaceChildren();
  if (!result.informative) { svg.setAttribute('aria-label', '全部观测相同，无法形成有信息的检验。'); return; }
  if (!Number.isInteger(index) || index < 0 || index >= result.total) throw Error('分配序号超出范围。');
  const x = value => 88 + value / 8 * 520, maxCount = Math.max(...result.frequencies.map(bin => bin.count)), step = Math.ceil(maxCount / 4), ceiling = step * 4;
  const y = count => 238 - count / ceiling * 180, patternId = svg.dataset.kwPattern || `kw-tail-${++patternCounter}`; svg.dataset.kwPattern = patternId;
  const defs = add(svg, 'defs', {}), pattern = add(defs, 'pattern', { id: patternId, width: 7, height: 7, patternUnits: 'userSpaceOnUse' });
  add(pattern, 'path', { d: 'M-1 1L1-1M0 7L7 0M6 8L8 6', stroke: '#9a472e', 'stroke-width': 1.2 });
  add(svg, 'line', { x1: 76, x2: 620, y1: 238, y2: 238, stroke: '#50655f' });
  add(svg, 'text', { x: 76, y: 28, class: 'kw-label' }, '分配数（共 1680）');
  for (let i = 0; i <= 4; i++) {
    add(svg, 'text', { x: 62, y: y(i * step) + 6, 'text-anchor': 'end', class: 'kw-tick' }, i * step);
    add(svg, 'line', { x1: 76, x2: 620, y1: y(i * step), y2: y(i * step), stroke: '#ccd6cf' });
  }
  for (const h of [0, 2, 4, 6, 8]) add(svg, 'text', { x: x(h), y: 270, 'text-anchor': 'middle', class: 'kw-tick' }, h);
  add(svg, 'text', { x: 620, y: 303, 'text-anchor': 'end', class: 'kw-label' }, 'Tie-corrected H');
  const gaps = result.frequencies.slice(1).map((bin, i) => bin.h - result.frequencies[i].h), width = Math.min(10, (gaps.length ? Math.min(...gaps) : 1) / 8 * 520 * .72);
  for (const bin of result.frequencies) {
    const attrs = { x: x(bin.h) - width / 2, y: y(bin.count), width, height: 238 - y(bin.count) };
    const bar = add(svg, 'rect', { ...attrs, fill: bin.inTail ? '#f6e3d9' : '#c5ded4', stroke: '#183a37', 'stroke-width': bin.score === result.allocations[index].score ? 3 : .7, 'data-kw-bin': bin.score, 'data-kw-tail': bin.inTail });
    add(bar, 'title', {}, `H=${show(bin.h)}；${bin.count} 个分配；${bin.inTail ? '计入右尾' : '不在右尾'}`);
    if (bin.inTail) add(svg, 'rect', { ...attrs, fill: `url(#${patternId})`, 'pointer-events': 'none' });
  }
  add(svg, 'line', { x1: x(result.h), x2: x(result.h), y1: 44, y2: 238, stroke: '#9a472e', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'data-kw-observed': result.h });
  svg.setAttribute('aria-label', `全部 1680 种分配的离散 H 分布；观测 H=${show(result.h)}，${result.tailCount} 个分配的 H 至少同样大，精确右尾 P=${show(result.exactP)}。当前查看 H=${show(result.allocations[index].h)}，粗边框表示对应柱。`);
}

export function mountKruskal(root) {
  if (root.dataset.kruskalReady) return;
  root.classList.add('kw-lab');
  const controls = defaults.map((group, i) => `<fieldset><legend>${groupNames[i]} 组：3 个独立单位</legend>${group.map((value, j) => `<label>${groupNames[i]}${j + 1}<input type="number" step="any" min="-1000000" max="1000000" value="${value}" data-kw-value="${i}-${j}"></label>`).join('')}</fieldset>`).join('');
  root.innerHTML = `<h3>九个观测：把小样本的参考分布全部列出来</h3><p>保留三个组、每组三个单位。先比较 χ² 近似与完整枚举，再载入 ties：相同数值的单位仍须分别计数。</p>
    <div class="kw-controls">${controls}</div><div class="kw-actions"><button type="button" data-kw-action="ties">载入 ties 例</button><button type="button" class="secondary" data-kw-action="reset">恢复原例</button></div>
    <p class="kw-error" data-kw-error role="alert"></p>
    <div data-kw-results><h4>① 合并排序，保留每个单位的身份</h4><p class="kw-note">表格较宽时，可在表格内左右滑动查看全部列。</p><div class="kw-table-wrap" tabindex="0" role="region" aria-label="合并排名表，可横向滚动"><table><thead><tr><th scope="col">固定 ID</th><th scope="col">原组</th><th scope="col">观测值</th><th scope="col">Average rank</th></tr></thead><tbody data-kw-ranks></tbody></table></div>
    <p data-kw-ties></p><p class="kw-readout" data-kw-result aria-live="polite"></p>
    <p class="kw-note">Hraw = 12/[9×10] × Σ(Rⱼ²/3) − 3×10；C = 1 − Σ(t³−t)/720；H = Hraw/C。t 是某个 tied block 的大小。合并 ranks 总和应为 45。</p>
    <div data-kw-inference><h4>② 固定数值，重排组标签</h4><p>先从 9 个固定 ID 中选 3 个给 A，再从剩余 6 个选 3 个给 B，其余给 C：C(9,3)×C(6,3)=84×20=1680。每次仍是 3/3/3；重复的 H 保留全部分配重数。</p>
    <figure><svg data-kw-plot viewBox="0 0 680 325" role="img"></svg><figcaption>离散柱高是分配数，不是密度。斜纹表示 H ≥ 观测 H 的右尾，含相等；虚线是观测 H，粗边框是当前查看的分配。</figcaption></figure>
    <label class="kw-step">查看一个参考分配 <output data-kw-index></output><input type="range" min="1" max="1680" step="1" value="1" data-kw-step></label>
    <div class="kw-actions"><button type="button" class="secondary" data-kw-prev>上一个</button><button type="button" class="secondary" data-kw-next>下一个</button></div><p data-kw-current></p>
    <p class="kw-note">移动滑块仅浏览 H₀ 的标签分配，原始分组、观测 H 与 P 都不改变；不进行自动播放。完整枚举没有 Monte Carlo 抽样误差。</p>
    <details><summary>按 H 核对所有分配数</summary><p class="kw-note">表格较宽时，可在表格内左右滑动查看全部列。</p><div class="kw-table-wrap" tabindex="0" role="region" aria-label="完整参考分布频数表，可横向滚动"><table><thead><tr><th scope="col">H</th><th scope="col">分配数</th><th scope="col">概率质量</th><th scope="col">计入右尾</th></tr></thead><tbody data-kw-frequency></tbody></table></div></details></div></div>
    <details><summary>复制当前数据到 base R 全枚举核对</summary><button type="button" class="secondary" data-kw-copy disabled>复制当前 R 代码</button><pre data-kw-code></pre><p class="kw-note" data-kw-copy-status role="status"></p></details>
    <p class="kw-note">“精确”以 H₀ 下组标签可交换为前提：例如独立单位来自相同分布，条件于观测和固定组大小时，1680 个标签分配等可能。只假定 means 或 medians 相等并不够；相关或配对数据不能直接这样洗牌。右尾是整体、无方向性的检验，不表示预设 A&lt;B&lt;C；拒绝也没有指出哪一对不同。这里比较 ranks 的分布差异，不自动是均值检验；共同形状、location-shift 等条件成立时才可作位置差解释。</p>`;
  const $ = selector => root.querySelector(selector), fields = indices.map(i => $(`[data-kw-value="${Math.floor(i / 3)}-${i % 3}"]`));
  const graph = $('[data-kw-plot]'), step = $('[data-kw-step]'), copy = $('[data-kw-copy]');
  let result = null, index = 0, revision = 0;
  function drawCurrent() {
    if (!result?.informative) return;
    step.value = String(index + 1); $('[data-kw-index]').textContent = `${index + 1} / 1680`;
    $('[data-kw-prev]').disabled = index === 0; $('[data-kw-next]').disabled = index === 1679;
    const current = result.allocations[index];
    const membership = current.members.map((group, i) => `${groupNames[i]}={${group.map(j => `${groupNames[Math.floor(j / 3)]}${j % 3 + 1}`).join(',')}}`).join('；');
    $('[data-kw-current]').textContent = `参考分配 ${index + 1}：${membership}。组秩和=(${current.rankSums.join(',')})；H=${show(current.h)}，${current.inTail ? '计入' : '不计入'}观测 H 的右尾。ID 中的字母记录原组；花括号前的字母是本次参考标签。`;
    drawKruskal(graph, result, index);
  }
  function update() {
    revision++; index = 0; $('[data-kw-copy-status]').textContent = '';
    try {
      const values = fields.map(field => parseKruskalValue(field.value)); result = kruskalAnalysis([values.slice(0, 3), values.slice(3, 6), values.slice(6)]);
      fields.forEach(field => field.setAttribute('aria-invalid', 'false')); $('[data-kw-error]').textContent = ''; $('[data-kw-results]').hidden = false;
      $('[data-kw-ranks]').innerHTML = result.rows.map(row => `<tr><th scope="row">${row.id}</th><td>${row.group}</td><td>${row.value}</td><td>${row.rank}</td></tr>`).join('');
      $('[data-kw-ties]').textContent = result.ties.length ? `Tied blocks：${result.ties.map(tie => `值 ${tie.value} × ${tie.size}（rank=${tie.rank}）`).join('；')}。Σ(t³−t)=${result.tieSum}。` : '没有 ties；Σ(t³−t)=0，因此 C=1。';
      $('[data-kw-inference]').hidden = !result.informative; step.disabled = !result.informative;
      if (!result.informative) {
        $('[data-kw-result]').textContent = '所有九个观测相同：ranks 全为 5，各组秩和为 15，C=0，Hraw=0，校正 H 为 0/0。数据没有可比较的秩差异，不能报告有信息的检验或常规 P。';
        graph.replaceChildren(); graph.setAttribute('aria-label', '全部观测相同，C=0。'); $('[data-kw-frequency]').innerHTML = '';
        $('[data-kw-code]').textContent = ''; copy.disabled = true; $('[data-kw-prev]').disabled = true; $('[data-kw-next]').disabled = true; return;
      }
      $('[data-kw-result]').textContent = `原组秩和 A/B/C=(${result.rankSums.join(',')})；Hraw=${show(result.rawH)}，C=${show(result.correction)}，H=${show(result.h)}。χ² 近似：df=2，P≈${show(result.approximateP)}。完整枚举右尾：${result.tailCount}/1680，P=${show(result.exactP)}。显示小数经过四舍五入；尾部比较使用整数分值 S=Σ(2Rⱼ)²，不会漏掉边界 ties。`;
      $('[data-kw-frequency]').innerHTML = result.frequencies.map(bin => `<tr><td>${show(bin.h)}</td><td>${bin.count}</td><td>${bin.count}/1680</td><td>${bin.inTail ? '是' : '否'}</td></tr>`).join('');
      $('[data-kw-code]').textContent = kruskalRCode(result.groups); copy.disabled = false; drawCurrent();
    } catch (error) {
      result = null; fields.forEach(field => field.setAttribute('aria-invalid', 'true'));
      $('[data-kw-error]').textContent = error.message; $('[data-kw-results]').hidden = true;
      graph.replaceChildren(); graph.setAttribute('aria-label', '等待九个有效观测'); $('[data-kw-code]').textContent = ''; copy.disabled = true; step.disabled = true;
      $('[data-kw-prev]').disabled = true; $('[data-kw-next]').disabled = true;
    }
  }
  fields.forEach(field => field.addEventListener('input', update));
  for (const preset of ['ties', 'reset']) $(`[data-kw-action="${preset}"]`).addEventListener('click', () => { const values = (preset === 'ties' ? tiedExample : defaults).flat(); fields.forEach((field, i) => field.value = String(values[i])); update(); });
  step.addEventListener('input', () => { const proposed = Number(step.value); if (result?.informative && Number.isInteger(proposed) && proposed >= 1 && proposed <= 1680) { index = proposed - 1; drawCurrent(); } });
  $('[data-kw-prev]').addEventListener('click', () => { if (result?.informative && index > 0) { index--; drawCurrent(); } });
  $('[data-kw-next]').addEventListener('click', () => { if (result?.informative && index < 1679) { index++; drawCurrent(); } });
  copy.addEventListener('click', async () => {
    if (!result?.informative) return;
    const version = revision, code = $('[data-kw-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-kw-copy-status]').textContent = '已复制当前九个观测与全部 1680 个分配的 R 检查代码。'; }
    catch { if (version === revision) $('[data-kw-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; }
  });
  update(); root.dataset.kruskalReady = 'true';
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-kruskal]').forEach(mountKruskal);
