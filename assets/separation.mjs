import { anova, invert, studentCDF } from './math.mjs';
import { equationHTML } from './formulas.mjs';

const groups = [[9, 12, 12, 15], [13, 16, 16, 19], [17, 20, 20, 23]];
const names = ['A', 'B', 'C'];
const pairs = [[0, 1], [1, 2], [0, 2]];
const alpha = .05;
const { means, mse, dfe } = anova(groups);
const n = groups[0].length;
const tCritical = invert(t => studentCDF(t, dfe), 1 - alpha / 2, 0, 50);
// qtukey(.95, nmeans = 3, df = 9) from base R for this fixed example.
const qCritical = 3.948492202268744;
const methods = {
  lsd: { label: 'Fisher LSD', threshold: tCritical * Math.sqrt(2 * mse / n), letters: ['c', 'b', 'a'] },
  tukey: { label: 'Tukey W', threshold: qCritical * Math.sqrt(mse / n), letters: ['b', 'ab', 'a'] },
};

export function separationExample(method) {
  if (!Object.hasOwn(methods, method)) throw new RangeError('Expected lsd or tukey.');
  const selected = methods[method];
  const comparisons = pairs.map(([i, j]) => {
    const gap = means[j] - means[i];
    return { i, j, gap, reject: gap > selected.threshold };
  });
  return { ...selected, comparisons };
}

export function mountSeparation(root) {
  const percentage = x => (10 * x) + '%';
  const initial = separationExample('lsd');
  const rows = initial.comparisons.map(({ i, j, gap }, index) => `
    <div class="sep-row">
      <div class="sep-row-label">
        <button type="button" class="secondary" data-sep-pair="${index}" aria-pressed="false">${names[j]} − ${names[i]}</button>
        <span>差 ${gap} cm</span><strong data-sep-result></strong>
      </div>
      <div class="sep-track" aria-hidden="true">
        <span class="sep-gap" style="--gap:${percentage(gap)}"></span><span class="sep-line"></span>
      </div>
    </div>`).join('');
  const groupCards = names.map((name, i) =>
    `<div><b>${name}</b> <span>${means[i]} cm</span> <strong data-sep-letter></strong></div>`
  ).join('');
  root.innerHTML = `
    <p><b>① 先判断</b></p>
    <p>均值差是 4 cm。LSD 按单对比较设门槛，Tukey 同时照顾三对比较。换规则后，同一个 4 cm 的判断可能改变吗？</p>
    <div class="sep-actions" role="group" aria-label="判断换规则的影响">
      <button type="button" class="secondary" data-sep-prediction="yes" aria-pressed="false">可能改变，因为门槛不同</button>
      <button type="button" class="secondary" data-sep-prediction="no" aria-pressed="false">差值一样，所以判断也一样</button>
    </div>
    <p data-sep-feedback role="status">选一个判断，再用两把尺核对。</p>
    <div data-sep-output hidden>
    <p><b>② 切换规则，再选一对</b></p>
    <div class="sep-actions" role="group" aria-label="选择成对比较规则">
      <button type="button" class="secondary" data-sep-method="lsd" aria-pressed="true">Fisher LSD</button>
      <button type="button" class="secondary" data-sep-method="tukey" aria-pressed="false">Tukey W</button>
    </div>
    <p data-sep-threshold></p>
    <div class="sep-rulers" role="group" aria-label="选择要跟踪的一对">${rows}</div>
    <div class="sep-ticks" aria-hidden="true"><span>0</span><span>5</span><span>10 cm</span></div>
    <p class="sep-key">深色条是均值差，竖线是门槛。三个刻度共用同一把尺。</p>
    <div class="sep-letters" aria-label="处理均值与当前分组字母">${groupCards}</div>
    <p class="sep-readout" data-sep-readout role="status"></p>
    <details>
      <summary>③ 展开门槛和差值的公式</summary>
      <div class="equation typeset-equation" data-sep-equation tabindex="0" role="region" aria-label="当前比较的计算"></div>
    </details></div>`;

  const methodButtons = [...root.querySelectorAll('[data-sep-method]')];
  const pairButtons = [...root.querySelectorAll('[data-sep-pair]')];
  const pairResults = [...root.querySelectorAll('[data-sep-result]')];
  const letters = [...root.querySelectorAll('[data-sep-letter]')];
  const threshold = root.querySelector('[data-sep-threshold]');
  const readout = root.querySelector('[data-sep-readout]');
  const equation = root.querySelector('[data-sep-equation]');
  let method = 'lsd', index = 0;

  function render() {
    const state = separationExample(method);
    const selected = state.comparisons[index];
    const mark = state.threshold.toFixed(4);
    root.style.setProperty('--threshold', percentage(state.threshold));
    threshold.textContent = method === 'lsd'
      ? 'LSD 门槛约 ' + mark + ' cm。每对各用双侧 5% 的 t 门槛。'
      : 'Tukey 门槛约 ' + mark + ' cm。用同一个门槛保护全部三对的家族误报率。';

    methodButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sepMethod === method)));
    state.comparisons.forEach(({ reject }, k) => {
      pairButtons[k].setAttribute('aria-pressed', String(index === k));
      pairResults[k].textContent = reject ? '超过门槛' : '未超过门槛';
    });
    state.letters.forEach((letter, i) => { letters[i].textContent = letter; });
    const { i, j, gap, reject } = selected;
    readout.textContent = state.label + ' 下，' + names[j] + ' 与 ' + names[i] + ' 的差 ' + gap + ' cm，' +
      (reject ? '超过门槛，拒绝这对总体均值相等。' : '没有超过门槛，这对总体均值的差异证据不足。') +
      '字母依次为 A ' + state.letters[0] + '、B ' + state.letters[1] + '、C ' + state.letters[2] + '。';
    const formula = method === 'lsd'
      ? String.raw`L=t_{.975,9}\sqrt{\frac{2(6)}4}`
      : String.raw`W=q_{.95;3,9}\sqrt{\frac64}`;
    equation.innerHTML = equationHTML(String.raw`\begin{gathered}
      ${formula}\approx${mark}\\
      \bar y_${names[j]}-\bar y_${names[i]}=${means[j]}-${means[i]}=${gap}\\
      ${gap}${reject ? '>' : '<'}${mark}
    \end{gathered}`);
  }
  const predictions = [...root.querySelectorAll('[data-sep-prediction]')];
  const feedback = root.querySelector('[data-sep-feedback]');
  const result = root.querySelector('[data-sep-output]');
  predictions.forEach(button => button.addEventListener('click', () => {
    const correct = button.dataset.sepPrediction === 'yes';
    predictions.forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    feedback.textContent = correct
      ? '选对了。选一对相差 4 cm 的组，切换规则，看 4 cm 落在门槛哪一边。'
      : '想想两把尺的门槛是否相同。如果 4 cm 在两条门槛之间，会发生什么？';
    result.hidden = !correct;
  }));
  methodButtons.forEach(button => button.addEventListener('click', () => { method = button.dataset.sepMethod; render(); }));
  pairButtons.forEach((button, i) => button.addEventListener('click', () => { index = i; render(); }));
  render();
}

if (typeof document !== 'undefined') document.querySelectorAll('[data-separation]').forEach(mountSeparation);
