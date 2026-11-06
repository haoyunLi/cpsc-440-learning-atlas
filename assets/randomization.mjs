import { seeded } from './math.mjs';
import { equationHTML } from './formulas.mjs';

const treatments = ['A', 'B', 'C'], environments = [2, 1, 0, -1, -2];
const initialSettings = { mode: 'rcbd', seed: 440 }, balancedCRDSeed = 26;
const modes = { rcbd: 'RCBD · 区组内抽签', crd: 'CRD · 全场抽签' };
const show = value => Number(value.toFixed(6)).toString();
const signed = value => value > 0 ? `+${show(value)}` : show(value);

function validateSettings({ mode, seed }) {
  if (!Object.hasOwn(modes, mode)) throw Error('请选择 RCBD 或 CRD 随机化方案。');
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw Error('Seed 须为 0–4294967295 的整数。');
}
export function parseRandomizationSeed(raw) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) throw Error('Seed 须为 0–4294967295 的十进制整数；空值不是 0。');
  const seed = Number(text); validateSettings({ mode: 'rcbd', seed }); return seed;
}
export function designSpaces() {
  return { rcbd: 7776, crd: 756756, balancedProbability: 7776 / 756756 };
}
export function allocateDesign({ mode, seed }) {
  validateSettings({ mode, seed }); const rng = seeded(seed);
  const shuffle = input => {
    const items = [...input];
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  };
  const labels = mode === 'rcbd' ? environments.flatMap(() => shuffle(treatments)) : shuffle(treatments.flatMap(treatment => Array(5).fill(treatment)));
  return { mode, seed, units: labels.map((treatment, i) => ({ id: `P${String(i + 1).padStart(2, '0')}`, block: Math.floor(i / 3) + 1, position: i % 3 + 1, environment: environments[Math.floor(i / 3)], treatment })) };
}
export function summarizeAllocation(allocation) {
  validateSettings(allocation);
  if (!Array.isArray(allocation.units) || allocation.units.length !== 15 || allocation.units.some((unit, i) => !unit || unit.id !== `P${String(i + 1).padStart(2, '0')}` || unit.block !== Math.floor(i / 3) + 1 || unit.position !== i % 3 + 1 || unit.environment !== environments[Math.floor(i / 3)] || !treatments.includes(unit.treatment))) throw Error('分配必须保留 P01–P15 的固定位置、block 与环境值。');
  const rows = treatments.map(treatment => {
    const units = allocation.units.filter(unit => unit.treatment === treatment);
    const counts = environments.map((_, i) => units.filter(unit => unit.block === i + 1).length);
    const environmentSum = units.reduce((sum, unit) => sum + unit.environment, 0);
    return { treatment, counts, total: units.length, environmentSum, meanEnvironment: environmentSum / units.length };
  });
  if (rows.some(row => row.total !== 5)) throw Error('此任务固定每种 treatment 各分配到 5 个花盆。');
  const balanced = rows.every(row => row.counts.every(count => count === 1));
  if (allocation.mode === 'rcbd' && !balanced) throw Error('RCBD 必须在每个 block 内各分配 A、B、C 一次。');
  return { rows, balanced, units: 15, blocks: 5, overallEnvironment: 0 };
}

export function randomizationRCode(allocation) {
  summarizeAllocation(allocation);
  return `# Actual displayed protocol: ${allocation.mode.toUpperCase()}. Teaching seed: ${allocation.seed}.
# This verifies the realized allocation, not an R reproduction of the JS RNG.
# No real experiment has been performed and no responses are invented.
d <- data.frame(id=c(${allocation.units.map(unit => `"${unit.id}"`).join(',')}),
                block=factor(rep(1:5,each=3),levels=1:5),
                position=rep(1:3,5),
                environment=rep(c(2,1,0,-1,-2),each=3),
                treatment=factor(c(${allocation.units.map(unit => `"${unit.treatment}"`).join(',')}),
                                 levels=c("A","B","C")))
print(d)
counts <- with(d,table(treatment,block))
print(counts)
mean_environment <- with(d,tapply(environment,treatment,mean))
print(mean_environment)
balanced <- all(counts==1)
stopifnot(nrow(d)==15,length(unique(d$id))==15,all(rowSums(counts)==5),
          all(colSums(counts)==3))
${allocation.mode === 'rcbd' ? 'stopifnot(balanced)\n' : ''}print(c(every_treatment_in_every_block=balanced))
# Counts concern distinct treatment assignments to the 15 fixed units.
rcbd_space <- factorial(3)^5
crd_space <- factorial(15)/factorial(5)^3
balance_probability <- rcbd_space/crd_space
print(c(RCBD_assignments=rcbd_space,CRD_assignments=crd_space,
        chance_of_complete_block_balance_under_uniform_CRD=balance_probability))
# The chance above is not a hypothesis-test P-value or an empirical seed rate.
# A balanced outcome does not change which randomization protocol was used.
# Each pot is a separately treated experimental unit; leaf subsamples do not
# increase the number of independent treatment assignments.
# No response, SE, power or treatment-effect estimate is calculated here.`;
}

export function mountRandomization(root) {
  if (root.dataset.randomizationReady) return;
  root.classList.add('rnd-lab');
  const blocks = environments.map((environment, b) => `<section class="rnd-block" aria-label="Block ${b + 1} 的三个固定花盆"><h4>Block ${b + 1}</h4><p>光照编码 ${signed(environment)}</p><div class="rnd-pots">${[0, 1, 2].map(position => { const id = `P${String(b * 3 + position + 1).padStart(2, '0')}`; return `<button type="button" data-rnd-pot="${id}" aria-pressed="false"><b>${id}</b><span data-rnd-label="${id}">—</span></button>`; }).join('')}</div></section>`).join('');
  const countRows = treatments.map(treatment => `<tr><th scope="row">${treatment}</th>${environments.map((_, b) => `<td data-rnd-count="${treatment}-${b}"></td>`).join('')}<td data-rnd-total="${treatment}"></td><td data-rnd-environment="${treatment}"></td></tr>`).join('');
  const strips = treatments.map(treatment => `<li class="rnd-strip" data-rnd-strip="${treatment}"><b>处理 ${treatment}</b><div class="rnd-exposures" data-rnd-exposures="${treatment}"></div></li>`).join('');
  const spaceMath = equationHTML(String.raw`\begin{gathered}
    N_{\mathrm{RCBD}}=(3!)^5=7776\\
    N_{\mathrm{CRD}}=\frac{15!}{5!\,5!\,5!}=756756\\
    P(\mathrm{balance}\mid\mathrm{CRD})\\
    =\frac{7776}{756756}\approx1.027544\%
  \end{gathered}`);
  root.innerHTML = `<h3>让三个处理都经历同样的光照带</h3><p>靠窗的一带最亮，最里的一带最暗。五个光照带各摆三盆，A、B、C 各用五盆。试两种抽签法，看看每种处理分到了哪些光照带。花盆和光照原地不动，只有处理标签会换。</p>
    <div class="rnd-actions" role="group" aria-label="用当前种子比较抽签范围"><button type="button" class="secondary" data-rnd-action="crd" aria-pressed="false">全场一起抽</button><button type="button" class="secondary" data-rnd-action="rcbd" aria-pressed="true">每个光照带分别抽</button><button type="button" class="secondary" data-rnd-action="balanced">看一次碰巧平衡的全场抽签</button></div>
    <details><summary>自己设置抽签范围和种子</summary>
    <div class="rnd-controls"><label>准备采用的方案<select data-rnd-mode><option value="rcbd">RCBD：每个 block 内各抽 A/B/C 一次</option><option value="crd">CRD：15 盆一起抽，A/B/C 各 5 个</option></select></label><label>教学 seed（0–4294967295）<input type="number" min="0" max="4294967295" step="1" value="440" data-rnd-seed inputmode="numeric"></label></div>
    <div class="rnd-actions"><button type="button" data-rnd-action="apply">按当前设置抽签</button><button type="button" class="secondary" data-rnd-action="next">Seed +1 再抽签</button><button type="button" class="secondary" data-rnd-action="reset">恢复初始</button></div>
    <p class="rnd-error" data-rnd-error role="alert"></p><p class="rnd-note" data-rnd-pending role="status"></p></details>
    <p class="rnd-applied" data-rnd-applied aria-live="polite"></p><p class="rnd-note" data-rnd-context></p>
    <p class="rnd-note">固定环境编码从 Block 1 的 +2 到 Block 5 的 −2，是由亮到暗的教学相对光照 score，没有物理单位，也不是观测到的响应。选择任意花盆查看其身份；可用 Tab 移动、Enter 或空格选择。</p>
    <div class="rnd-blocks" role="group" aria-label="15 个固定花盆的当前分配">${blocks}</div><p class="rnd-selection" data-rnd-selection></p>
    <h4>把每种处理的五盆排成一行</h4><p>每个小格是一盆，格里的正负数是它所在光照带的编码 z。点选上方任一盆，可以跟踪它拿到的处理和这一行的平均光照编码。</p>
    <ul class="rnd-strips" aria-label="各处理经历的五个光照位置">${strips}</ul>
    <div class="equation typeset-equation" data-rnd-light-math tabindex="0" role="region" aria-label="选中处理的平均光照，可横向滚动"></div>
    <p data-rnd-balance></p>
    <details><summary>展开各处理在每个光照带的盆数</summary><div class="rnd-table-wrap" tabindex="0" role="region" aria-label="各处理在每个光照带的盆数及平均光照，可横向滚动"><table><thead><tr><th scope="col">处理</th>${environments.map((_, b) => `<th scope="col">Block ${b + 1}</th>`).join('')}<th scope="col">总盆数</th><th scope="col">平均光照编码</th></tr></thead><tbody>${countRows}</tbody></table></div><p class="rnd-note">两行平均光照即使相同，盆数也可能分布在不同光照带。要核对每带是否各一次，看每一格盆数。</p></details>
    <details><summary>7776 与 756756：两种方案允许多少个分配？</summary><p>每带分别抽时，三张不同标签有六种顺序，五带的顺序相乘。全场抽时，十五个位置分给三种处理，各有五个相同标签。恰巧每带都平衡的布局占全场允许布局的比例，就是下面的条件概率。</p><div class="equation typeset-equation" tabindex="0" role="region" aria-label="两种抽签范围的布局数，可横向滚动">${spaceMath}</div><p>这个概率来自等概率全场抽签允许的布局。一次全场抽签恰好平衡，记录下来的抽签规则仍是 CRD。</p></details>
    <p class="rnd-note">实验单位是被单独分配处理的 15 个花盆，不是 5 个 blocks。每盆多测几片叶是盆内子样本，不会增加独立处理分配数。结构检查不能单独证明误差独立；仍须排除花盆间干扰、共同施加处理等问题。改变分析公式不能倒过来改写实验时的随机化方案。</p>
    <details><summary>复制当前实际分配到 base R 核对</summary><button type="button" class="secondary" data-rnd-copy>复制当前 R 代码</button><pre data-rnd-code></pre><p class="rnd-note" data-rnd-copy-status role="status"></p></details>
    <p class="rnd-note">这是实施前的教学模拟，尚未进行真实实验。Seed 控制浏览器的可复现伪随机数；算法按所选范围洗牌，不保证整数 seed 均匀覆盖全部合法设计。复制的 R 代码直接检查当前表，不声称 R 用同一 seed 会得到相同排列。本模块没有响应数据，不计算 treatment effect、SE 或 P。</p>`;
  const $ = selector => root.querySelector(selector), mode = $('[data-rnd-mode]'), seed = $('[data-rnd-seed]'), copy = $('[data-rnd-copy]');
  const pots = Array.from({ length: 15 }, (_, i) => $(`[data-rnd-pot="P${String(i + 1).padStart(2, '0')}"]`));
  let allocation = allocateDesign(initialSettings), selected = 'P01', revision = 0;
  const readSettings = () => { const settings = { mode: mode.value, seed: parseRandomizationSeed(seed.value) }; validateSettings(settings); return settings; };
  function pending() {
    const current = `${modes[allocation.mode]}，seed=${allocation.seed}`;
    try {
      const draft = readSettings(); $('[data-rnd-error]').textContent = ''; seed.setAttribute('aria-invalid', 'false');
      $('[data-rnd-pending]').textContent = draft.mode === allocation.mode && draft.seed === allocation.seed ? '设置与当前分配一致。相同设置再次抽签会重现同一张表。' : `设置尚未应用；下方图、统计和 R 代码仍为 ${current}。点击“按当前设置抽签”后更新。`;
      $('[data-rnd-action="next"]').disabled = draft.seed === 4294967295;
    } catch (error) {
      seed.setAttribute('aria-invalid', 'true'); $('[data-rnd-error]').textContent = error.message;
      $('[data-rnd-pending]').textContent = `设置无效，未重新分配；下方仍显示 ${current}，复制的也是这张已应用表。`;
      $('[data-rnd-action="next"]').disabled = true;
    }
  }
  function selection() {
    const unit = allocation.units.find(unit => unit.id === selected);
    allocation.units.forEach((item, i) => pots[i].setAttribute('aria-pressed', String(item.id === selected)));
    $('[data-rnd-selection]').textContent = `${unit.id}：Block ${unit.block}，该 block 内位置 ${unit.position}，光照编码 ${signed(unit.environment)}，当前分配 treatment ${unit.treatment}。它是一盆单独接受处理的实验单位；ID 与物理位置不会随抽签改变。`;
    for (const treatment of treatments) $(`[data-rnd-strip="${treatment}"]`).setAttribute('data-selected', String(treatment === unit.treatment));
    const exposure = allocation.units.filter(item => item.treatment === unit.treatment).map(item => item.environment);
    const numerator = exposure.map((value, i) => i && value >= 0 ? '+' + value : String(value)).join('');
    const mean = exposure.reduce((total, value) => total + value, 0) / exposure.length;
    $('[data-rnd-light-math]').innerHTML = equationHTML(String.raw`\bar z_{\mathrm{${unit.treatment}}}=\frac{${numerator}}{${exposure.length}}=${show(mean)}`);
  }
  function render() {
    const summary = summarizeAllocation(allocation); revision++; $('[data-rnd-copy-status]').textContent = '';
    $('[data-rnd-applied]').textContent = `已应用：${modes[allocation.mode]}；seed=${allocation.seed}。15 个固定花盆，A/B/C 各 5 盆。`;
    for (const scheme of Object.keys(modes)) $(`[data-rnd-action="${scheme}"]`).setAttribute('aria-pressed', String(scheme === allocation.mode));
    allocation.units.forEach((unit, i) => {
      $(`[data-rnd-label="${unit.id}"]`).textContent = `处理 ${unit.treatment}`;
      pots[i].setAttribute('data-treatment', unit.treatment);
      pots[i].setAttribute('aria-label', `${unit.id}，Block ${unit.block} 位置 ${unit.position}，环境 ${signed(unit.environment)}，处理 ${unit.treatment}`);
    });
    summary.rows.forEach(row => {
      $(`[data-rnd-exposures="${row.treatment}"]`).innerHTML = allocation.units.filter(unit => unit.treatment === row.treatment).map(unit => `<span data-rnd-light="${unit.block}"><span>带 ${unit.block}</span><b>${signed(unit.environment)}</b></span>`).join('');
      row.counts.forEach((count, b) => $(`[data-rnd-count="${row.treatment}-${b}"]`).textContent = String(count));
      $(`[data-rnd-total="${row.treatment}"]`).textContent = String(row.total);
      $(`[data-rnd-environment="${row.treatment}"]`).textContent = signed(row.meanEnvironment);
    });
    $('[data-rnd-balance]').textContent = summary.balanced
      ? `${allocation.mode === 'rcbd' ? '本次满足 RCBD 的设计约束' : '本次 CRD 碰巧也满足完整区组平衡；抽签协议仍是 CRD'}：每种处理在每个 block 恰好一盆。`
      : '本次 CRD 仅保证每种处理总数为 5；有些 block 内会重复某处理或缺少某处理。这是该随机化方案允许的结果。';
    $('[data-rnd-code]').textContent = randomizationRCode(allocation); selection(); pending();
  }
  function apply(settings, context) {
    allocation = allocateDesign(settings); mode.value = settings.mode; seed.value = String(settings.seed);
    $('[data-rnd-context]').textContent = context; render();
  }
  mode.addEventListener('change', pending); seed.addEventListener('input', pending);
  for (const scheme of Object.keys(modes)) {
    $(`[data-rnd-action="${scheme}"]`).addEventListener('click', () => apply({ mode: scheme, seed: allocation.seed }, '用当前已应用的种子切换抽签范围，花盆位置和光照保持原样。'));
  }
  $('[data-rnd-action="apply"]').addEventListener('click', () => { try { apply(readSettings(), '仅在教学表中按已选方案重新抽签；未实施真实处理。'); } catch { pending(); } });
  $('[data-rnd-action="next"]').addEventListener('click', () => { try { const settings = readSettings(); if (settings.seed < 4294967295) apply({ ...settings, seed: settings.seed + 1 }, '在当前设置的 seed 上加 1，再按所选范围抽签。'); } catch { pending(); } });
  $('[data-rnd-action="balanced"]').addEventListener('click', () => apply({ mode: 'crd', seed: balancedCRDSeed }, '这是预先挑出的一个真正由 CRD 全场洗牌得到的平衡示例（seed=26），不是每次都会如此，不能用此单例估计平衡概率。'));
  $('[data-rnd-action="reset"]').addEventListener('click', () => { selected = 'P01'; apply(initialSettings, '已恢复初始 RCBD 教学分配。'); });
  pots.forEach((button, i) => button.addEventListener('click', () => { selected = `P${String(i + 1).padStart(2, '0')}`; selection(); }));
  copy.addEventListener('click', async () => {
    const version = revision, code = $('[data-rnd-code]').textContent;
    try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-rnd-copy-status]').textContent = `已复制已应用的 ${allocation.mode.toUpperCase()}、seed=${allocation.seed} 分配；待应用设置不包含在内。`; }
    catch { if (version === revision) $('[data-rnd-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; }
  });
  mode.value = initialSettings.mode; seed.value = String(initialSettings.seed); render(); root.dataset.randomizationReady = 'true';
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-randomization]').forEach(mountRandomization);
