import { betaCDF, studentQuantile } from './math.mjs';

const originalA = [8, 14, 20, 26, 32], originalB = [9, 16, 23, 28, 34];
const modes = { correct: '原始配对', reorder: '两列整行反序', shuffle: '仅反转 B：故意错误匹配' };
const show = value => value === 0 ? '0' : Math.abs(value) < .0001 ? value.toExponential(4) : Number(value.toPrecision(8)).toString();
const ids = ['P1', 'P2', 'P3', 'P4', 'P5'];
function checkSelected(id) { if (!ids.includes(id)) throw Error('请选择 P1–P5 中一个原始 A 观测。'); }

export function pairedAnalysis(mode = 'correct') {
  if (!Object.hasOwn(modes, mode)) throw Error('请选择原始配对、整行反序或仅反转 B。');
  const n = 5, orderA = mode === 'reorder' ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
  const orderB = mode === 'correct' ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  const rows = orderA.map((ai, index) => {
    const bi = orderB[index];
    return { index, ai, bi, aId: ids[ai], bId: ids[bi], a: originalA[ai], b: originalB[bi], difference: originalB[bi] - originalA[ai], matched: ai === bi };
  });
  const meanA = rows.reduce((sum, row) => sum + row.a, 0) / n;
  const meanB = rows.reduce((sum, row) => sum + row.b, 0) / n;
  const meanD = rows.reduce((sum, row) => sum + row.difference, 0) / n;
  for (const row of rows) {
    row.centeredA = row.a - meanA; row.centeredB = row.b - meanB; row.centeredD = row.difference - meanD;
    row.crossProduct = row.centeredA * row.centeredB; row.squaredDeviation = row.centeredD ** 2;
  }
  const varA = rows.reduce((sum, row) => sum + row.centeredA ** 2, 0) / (n - 1);
  const varB = rows.reduce((sum, row) => sum + row.centeredB ** 2, 0) / (n - 1);
  const crossSum = rows.reduce((sum, row) => sum + row.crossProduct, 0), covariance = crossSum / (n - 1);
  const differenceSS = rows.reduce((sum, row) => sum + row.squaredDeviation, 0), varD = differenceSS / (n - 1);
  const identity = varA + varB - 2 * covariance, se = Math.sqrt(varD / n), ratio = meanD / se;
  const validPairing = rows.every(row => row.matched), df = n - 1, critical = studentQuantile(.975, df);
  const inference = validPairing ? { df, t: ratio, p: betaCDF(df / (df + ratio ** 2), df / 2, .5), critical, low: meanD - critical * se, high: meanD + critical * se } : null;
  return { mode, title: modes[mode], n, orderA, orderB, rows, meanA, meanB, meanD, varA, varB, crossSum, covariance,
    correlation: covariance / Math.sqrt(varA * varB), differenceSS, varD, identity, se, ratio,
    independentFormulaSE: Math.sqrt((varA + varB) / n), validPairing, inference };
}

export function pairedRCode(mode = 'correct', selectedAId = 'P1') {
  const r = pairedAnalysis(mode); checkSelected(selectedAId);
  return `# Original teaching data: pair IDs are fixed by the design.
# A pair can be repeated measurements or two distinct matched units.
original <- data.frame(pair_id=paste0("P",1:5),
                       A=c(8,14,20,26,32),B=c(9,16,23,28,34))
mode <- "${mode}"
row_A <- c(${r.orderA.map(index => index + 1).join(',')})
row_B <- c(${r.orderB.map(index => index + 1).join(',')})
current <- data.frame(A_id=original$pair_id[row_A],A=original$A[row_A],
                      B_id=original$pair_id[row_B],B=original$B[row_B])
current$D <- current$B-current$A
current$matched <- current$A_id==current$B_id
current$cross_product <- (current$A-mean(current$A))*(current$B-mean(current$B))
current$squared_D_deviation <- (current$D-mean(current$D))^2
n <- nrow(current)
sample_covariance <- cov(current$A,current$B)
direct_variance <- var(current$D)
identity_variance <- var(current$A)+var(current$B)-2*sample_covariance
se_arithmetic <- sqrt(direct_variance/n)
independent_formula_SE <- sqrt(var(current$A)/n+var(current$B)/n)
valid_pairing <- all(current$matched)
selected_A_id <- "${selectedAId}"
print(original)
print(current)
print(current[current$A_id==selected_A_id,])
print(c(mean_A=mean(current$A),mean_B=mean(current$B),
        variance_A=var(current$A),variance_B=var(current$B),
        covariance=sample_covariance,correlation=cor(current$A,current$B),
        mean_D=mean(current$D),direct_variance=direct_variance,
        identity_variance=identity_variance,SE_arithmetic=se_arithmetic,
        independent_formula_SE=independent_formula_SE),digits=12)
stopifnot(abs(direct_variance-identity_variance)<1e-12,
          abs(sum(current$cross_product)/(n-1)-sample_covariance)<1e-12)
${r.validPairing ? `# Matching is preserved; inference additionally assumes independent pairs
# and a normal distribution of differences for exact small-sample t inference.
stopifnot(valid_pairing)
paired_test <- t.test(current$B,current$A,paired=TRUE,mu=0,conf.level=.95)
difference_test <- t.test(current$D,mu=0,conf.level=.95)
print(paired_test)
stopifnot(isTRUE(all.equal(unname(paired_test$statistic),unname(difference_test$statistic))),
          isTRUE(all.equal(paired_test$conf.int,difference_test$conf.int)))` : `# Deliberately mismatched identities: the preceding numbers are arithmetic only.
# This is NOT a valid paired analysis of the original study.
# Do not report a P-value or confidence interval from these false pairs.
stopifnot(!valid_pairing)
print("Mismatched pair IDs: no inferential test is performed.")`}
# The independent-formula SE is a comparison of formulas, not authorization
# to treat the original paired observations as independent groups.
# Reordering complete rows preserves matches; reordering B alone does not.`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const element = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
export function drawPaired(svg, result, selectedAId = 'P1') {
  svg.replaceChildren();
  if (!result) { svg.setAttribute('aria-label', '等待有效配对模式'); return; }
  checkSelected(selectedAId);
  const y = value => 302 - value / 40 * 250, xA = 185, xB = 490;
  for (const tick of [0, 10, 20, 30, 40]) {
    add(svg, 'line', { x1: 80, x2: 610, y1: y(tick), y2: y(tick), stroke: '#ccd6cf' });
    add(svg, 'text', { x: 65, y: y(tick) + 6, 'text-anchor': 'end', class: 'pair-tick' }, tick);
  }
  add(svg, 'text', { x: 80, y: 28, class: 'pair-label' }, 'Response Y');
  add(svg, 'text', { x: xA, y: 345, 'text-anchor': 'middle', class: 'pair-label' }, 'A');
  add(svg, 'text', { x: xB, y: 345, 'text-anchor': 'middle', class: 'pair-label' }, 'B');
  // Draw the selected line last so it stays visible at crossings. Point
  // identities remain fixed even in the deliberately mismatched display.
  const ordered = [...result.rows].sort((a, b) => Number(a.aId === selectedAId) - Number(b.aId === selectedAId));
  for (const row of ordered) {
    const selected = row.aId === selectedAId, color = row.matched ? '#086f68' : '#9a472e';
    add(svg, 'line', { x1: xA, x2: xB, y1: y(row.a), y2: y(row.b), stroke: color, 'stroke-width': selected ? 5 : 2,
      'stroke-dasharray': row.matched ? '' : '7 5', opacity: selected ? 1 : .5, 'data-pair-link': row.aId, 'data-matched': row.matched, 'data-selected': selected });
  }
  for (const row of result.rows) {
    const selected = row.aId === selectedAId;
    for (const [group, x, value, id, dx, anchor] of [['A', xA, row.a, row.aId, -18, 'end'], ['B', xB, row.b, row.bId, 18, 'start']]) {
      add(svg, 'circle', { cx: x, cy: y(value), r: selected ? 7 : 5, fill: '#086f68', stroke: selected ? '#183a37' : '#fff', 'stroke-width': selected ? 3 : 1,
        'data-pair-point': `${group}-${id}`, 'data-selected': selected });
      add(svg, 'text', { x: x + dx, y: y(value) + 6, 'text-anchor': anchor, class: 'pair-label', 'font-weight': selected ? 700 : 400 }, id);
    }
  }
  const current = result.rows.find(row => row.aId === selectedAId);
  svg.setAttribute('aria-label', `${result.title}。固定横向 A、B 与纵轴 0–40；P1–P5 是设计确定的原始 pair ID。${result.validPairing ? '所有连线保留相同 pair ID。' : '虚线连接不同原始 pair ID，是故意错误匹配；中间 P3 仍匹配，但整套映射无效。'}当前追踪 A 的 ${current.aId}=${current.a} → B 的 ${current.bId}=${current.b}，D=B−A=${current.difference}。`);
}

export function mountPaired(root) {
  if (root.dataset.pairedReady) return;
  root.classList.add('pair-lab');
  root.innerHTML = `<p>五个设计事先确定的 pairs 保留固定身份 P1–P5。配对可以来自同一单位的两次测量，也可以来自设计中匹配的两个不同单位；不能靠排序后看起来相近就创造配对。</p>
    <div class="pair-controls"><label for="pair-mode">操作对应关系<select id="pair-mode" data-pair-mode><option value="correct">原始配对：保留 pair ID</option><option value="reorder">两列整行反序：仍保留 pair ID</option><option value="shuffle">仅反转 B：故意错误匹配</option></select></label><button type="button" class="secondary" data-pair-reset>恢复原始配对</button></div>
    <p class="pair-error" data-pair-error role="alert"></p><p class="pair-readout" data-pair-status role="status"></p>
    <div data-pair-results><figure><svg data-pair-plot="main" viewBox="0 0 680 375" role="img"></svg><figcaption>每个点始终保留原始 ID；粗线与外圈标出表中选中的连接。实线连接同一 pair ID，虚线连接不同 ID。三个模式共用固定纵轴，数值没有改写。</figcaption></figure>
    <details class="pair-enlarge"><summary>放大查看连线与观测 ID</summary><div class="pair-large-wrap" tabindex="0" role="region" aria-label="放大的配对图，可横向滚动"><svg data-pair-plot="large" viewBox="0 0 680 375" role="img"></svg></div></details>
    <h3>逐行核对：连的是谁，差值是多少？</h3><p class="pair-note">点击“追踪”可高亮对应观测。后两列是求和前的分子贡献；各自求和后除以 n−1=4，才得到 sample covariance 与差值 sample variance。窄屏请在表内横向滚动。</p>
    <div class="pair-table-wrap" tabindex="0" role="region" aria-label="当前连接、差值与方差贡献，可横向滚动"><table><thead><tr><th scope="col">追踪 A ID → B ID</th><th scope="col">A</th><th scope="col">B</th><th scope="col">D=B−A</th><th scope="col">(A−Ā)(B−B̄)</th><th scope="col">(D−D̄)²</th></tr></thead><tbody>${ids.map((id, i) => `<tr data-pair-table-row="${i}"><th scope="row"><button type="button" class="secondary" data-pair-select="${i}" aria-pressed="false"></button></th>${['a', 'b', 'difference', 'crossProduct', 'squaredDeviation'].map(key => `<td data-pair-cell="${i}-${key}"></td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th scope="row" colspan="4">分子贡献之和</th><td data-pair-cross-sum></td><td data-pair-difference-ss></td></tr></tfoot></table></div>
    <p class="pair-readout" data-pair-selected aria-live="polite"></p>
    <h3>同一恒等式，指出变化来自哪里</h3><div data-pair-identity></div><p data-pair-invariants></p><p class="pair-note">“独立公式值”仅为忽略配对的算式对照，不表示这份配对数据可以合法改用独立样本检验。样本 covariance 是当前数据的描述，不等于已知总体 Cov。</p>
    <div class="pair-readout" data-pair-inference></div></div>
    <details><summary>复制当前 ID 映射到 base R 核对</summary><button type="button" class="secondary" data-pair-copy>复制当前 R 代码</button><pre data-pair-code></pre><p class="pair-note" data-pair-copy-status role="status"></p></details>
    <p class="pair-note">真实配对必须由研究设计或可靠 ID 确定。不同 pairs 须独立；精确小样本 t 推断的正态条件针对 differences。n=5 指五个独立 pairs，不是把十次测量当作十个独立差值。需要输入自己的原始数据时，可用<a href="../labs.html#two-sample">两样本工作台</a>；核对其 A−B 与本实验 B−A 的方向。</p>`;
  const $ = selector => root.querySelector(selector), mode = $('[data-pair-mode]'), copy = $('[data-pair-copy]');
  let selectedAId = 'P1', result = null, revision = 0;
  function update() {
    revision++; $('[data-pair-copy-status]').textContent = '';
    try {
      result = pairedAnalysis(mode.value); checkSelected(selectedAId);
      mode.setAttribute('aria-invalid', 'false'); $('[data-pair-error]').textContent = ''; $('[data-pair-results]').hidden = false; copy.disabled = false;
      $('[data-pair-status]').textContent = result.validPairing
        ? result.mode === 'correct' ? '原始配对：每行 A 与 B 的原始 pair ID 一致。先看差值，再尝试两列整行反序。' : '整行反序只改变显示顺序；pair ID、每个差值及全部汇总和推断保持一致。'
        : '故意错误匹配：只反转 B 后，有四行跨越原始 pair ID。下方数字只解释错配的算术后果；不提供此映射的正式 P 值或 CI。';
      for (const graph of ['main', 'large']) drawPaired($(`[data-pair-plot="${graph}"]`), result, selectedAId);
      for (const row of result.rows) {
        const button = $(`[data-pair-select="${row.index}"]`), selected = row.aId === selectedAId;
        button.textContent = `${row.aId} → ${row.bId}${row.matched ? '' : '（错配）'}`;
        button.setAttribute('aria-pressed', String(selected)); button.disabled = false;
        $(`[data-pair-table-row="${row.index}"]`).setAttribute('data-selected', String(selected));
        for (const key of ['a', 'b', 'difference', 'crossProduct', 'squaredDeviation']) $(`[data-pair-cell="${row.index}-${key}"]`).textContent = show(row[key]);
      }
      $('[data-pair-cross-sum]').textContent = show(result.crossSum); $('[data-pair-difference-ss]').textContent = show(result.differenceSS);
      const row = result.rows.find(item => item.aId === selectedAId);
      $('[data-pair-selected]').textContent = `当前第 ${row.index + 1} 行：A 的 ${row.aId}=${row.a}，连接 B 的 ${row.bId}=${row.b}。D=${row.b}−${row.a}=${row.difference}；协方差分子贡献=(${row.a}−${result.meanA})×(${row.b}−${result.meanB})=${row.crossProduct}；差值方差分子贡献=(${row.difference}−${result.meanD})²=${row.squaredDeviation}。${row.matched ? '这条连接保留原始 pair ID。' : `这是错误的跨 ID 连接；${row.aId} 原本对应的 B 值是 ${originalB[row.ai]}。`}`;
      $('[data-pair-identity]').innerHTML = `<p>Ā=${result.meanA}，B̄=${result.meanB}，D̄=B̄−Ā=${result.meanD}；sA²=${result.varA}，sB²=${result.varB}。</p><p class="pair-equation">sAB=Σ(A−Ā)(B−B̄)/(n−1)=${result.crossSum}/4=${result.covariance}<br>sD²=sA²+sB²−2sAB=${result.varA}+${result.varB}−2×(${result.covariance})=${result.identity}<br>直接算差值方差：Σ(D−D̄)²/(n−1)=${result.differenceSS}/4=${result.varD}<br>SE 算式=√(sD²/n)=√(${result.varD}/5)≈${show(result.se)}</p><p>当前 sample correlation r≈${show(result.correlation)}。${result.validPairing ? '正 covariance 在差值方差中被减去，共享背景因此抵消。' : '错配把 covariance 从原始的 93 改为 −93；两组各自的均值和方差没有变，差值的离散却大幅增加。'}</p>`;
      $('[data-pair-invariants]').textContent = `三个模式都保留 A=[${originalA.join(', ')}]、B=[${originalB.join(', ')}] 各自的全部数值与边际分布；D̄ 始终为 2。忽略配对的独立公式值 √(sA²/5+sB²/5)=√(90/5+96.5/5)≈${show(result.independentFormulaSE)} 也不变。只有保持 ID 对应的整行换序才保留原始差值、covariance 和 paired SE。`;
      $('[data-pair-inference]').textContent = result.inference
        ? `在独立 pairs 与正态差值模型下，H₀: μD=0，方向 B−A。t=D̄/SE≈${show(result.inference.t)}，df=n−1=4；双侧 P≈${show(result.inference.p)}。95% CI=2±${show(result.inference.critical)}×${show(result.se)}≈[${show(result.inference.low)}, ${show(result.inference.high)}]。本例在这些条件下支持正的总体平均差。`
        : `此映射不是原研究的配对：D̄/SE≈${show(result.ratio)} 只是错误连接后的算术比值。本实验不将它报告为有效配对检验，也不给出其 P 值或置信区间。不能通过试配对来挑选有利结论。`;
      $('[data-pair-code]').textContent = pairedRCode(result.mode, selectedAId);
    } catch (error) {
      result = null; mode.setAttribute('aria-invalid', 'true'); $('[data-pair-error]').textContent = error.message + ' 当前不显示旧结果。';
      $('[data-pair-results]').hidden = true; $('[data-pair-status]').textContent = '等待有效的配对模式；可恢复原始配对。';
      $('[data-pair-code]').textContent = ''; copy.disabled = true;
      for (const graph of ['main', 'large']) drawPaired($(`[data-pair-plot="${graph}"]`), null);
      for (let i = 0; i < 5; i++) $(`[data-pair-select="${i}"]`).disabled = true;
    }
  }
  mode.addEventListener('change', update);
  $('[data-pair-reset]').addEventListener('click', () => { mode.value = 'correct'; selectedAId = 'P1'; update(); });
  for (let i = 0; i < 5; i++) $(`[data-pair-select="${i}"]`).addEventListener('click', () => { if (result) { selectedAId = result.rows[i].aId; update(); } });
  copy.addEventListener('click', async () => {
    if (!result) return; const version = revision, code = $('[data-pair-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-pair-copy-status]').textContent = result.validPairing ? '已复制原始数据、当前 ID 映射与配对推断。' : '已复制当前错配的算术演示；代码不会进行正式配对检验。'; }
    catch { if (version === revision) $('[data-pair-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; }
  });
  update(); root.dataset.pairedReady = 'true';
}
