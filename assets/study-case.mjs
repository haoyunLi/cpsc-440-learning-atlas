import { twoSample } from './workbench.mjs';

const show = value => value === 0 ? '0' : Math.abs(value) < .0001 ? value.toExponential(4) : Number(value.toPrecision(8)).toString();

export function studyCaseAnalysis(pots) {
  if (!Array.isArray(pots) || pots.length !== 12) throw Error('本案例需要十二盆的完整记录。');
  const seen = new Set();
  const summaries = pots.map(pot => {
    if (!pot || typeof pot.id !== 'string' || !/^P\d{2}$/.test(pot.id) || seen.has(pot.id)) throw Error('每盆须有唯一的 P01 格式 ID。');
    seen.add(pot.id);
    if (!['A', 'B'].includes(pot.treatment) || !Array.isArray(pot.values) || pot.values.length !== 3 || pot.values.some(value => !Number.isFinite(value) || Math.abs(value) > 1e6)) throw Error('每盆须属于 A 或 B，并有三个有限观测值。');
    const values = [...pot.values], sum = values.reduce((total, value) => total + value, 0);
    return { id: pot.id, treatment: pot.treatment, values, sum, mean: sum / 3 };
  });
  const groups = ['A', 'B'].map(treatment => {
    const groupPots = summaries.filter(pot => pot.treatment === treatment);
    if (groupPots.length !== 6) throw Error('本案例要求 A、B 各六个独立花盆。');
    const meanSum = groupPots.reduce((total, pot) => total + pot.mean, 0), mean = meanSum / groupPots.length;
    for (const pot of groupPots) { pot.groupMean = mean; pot.meanContribution = pot.mean / groupPots.length; }
    return { treatment, n: groupPots.length, plantCount: groupPots.length * 3, potIds: groupPots.map(pot => pot.id), means: groupPots.map(pot => pot.mean), meanSum, mean };
  });
  const a = groups[0].means, b = groups[1].means;
  const rawA = summaries.filter(pot => pot.treatment === 'A').flatMap(pot => pot.values), rawB = summaries.filter(pot => pot.treatment === 'B').flatMap(pot => pot.values);
  return { pots: summaries, groups, potCount: 12, plantCount: 36, direction: 'B − A',
    welch: twoSample(b, a, 'welch'),
    naive: { ...twoSample(rawB, rawA, 'welch'), validInference: false, diagnosticOnly: true,
      label: '错误地把同盆三株当作独立重复：仅用于诊断伪重复，不能据此报告正式推断。' } };
}

function validQuestion(question) {
  if (!question || typeof question.answer !== 'string' || !question.answer || !question.feedback || typeof question.feedback !== 'object' || Array.isArray(question.feedback) || !Object.hasOwn(question.feedback, question.answer) || Object.entries(question.feedback).some(([key, value]) => !key || typeof value !== 'string' || !value.trim())) throw Error('学习检查的答案与解释不完整。');
}
export function gradeCase(question, value) {
  validQuestion(question);
  if (value === null || value === undefined || typeof value !== 'string' || !value.trim()) return { valid: false, correct: false, feedback: '请先选择一个答案，再检查。' };
  if (!Object.hasOwn(question.feedback, value)) return { valid: false, correct: false, feedback: '请选择本题提供的选项，再检查。' };
  return { valid: true, correct: value === question.answer, feedback: question.feedback[value] };
}

export function studyCaseGeometry(analysis) {
  const values = analysis.pots.flatMap(pot => pot.values), low = Math.min(8, Math.floor(Math.min(...values) - 2)), high = Math.max(30, Math.ceil(Math.max(...values) + 2));
  const tops = [58, 303], height = 155, xs = [118, 211, 304, 397, 490, 583];
  const y = (value, groupIndex) => tops[groupIndex] + (high - value) / (high - low) * height;
  const groups = analysis.groups.map((group, gi) => ({ ...group, index: gi, top: tops[gi], bottom: tops[gi] + height, meanY: y(group.mean, gi) }));
  const pots = analysis.pots.map(pot => {
    const gi = pot.treatment === 'A' ? 0 : 1, index = groups[gi].potIds.indexOf(pot.id), x = xs[index];
    return { id: pot.id, treatment: pot.treatment, groupIndex: gi, x, meanY: y(pot.mean, gi),
      points: pot.values.map((value, i) => ({ id: `${pot.id}-${i + 1}`, value, x: x + (i - 1) * 11, y: y(value, gi) })) };
  });
  const tickValues = low === 8 && high === 30 ? [10, 15, 20, 25, 30] : Array.from({ length: 5 }, (_, i) => low + i * (high - low) / 4);
  return { low, high, groups, pots, ticks: groups.map(group => tickValues.map(value => ({ value, text: show(value), y: y(value, group.index) }))) };
}
const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const element = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
export function drawStudyCase(svg, analysis, selectedId = 'P01') {
  const selected = analysis.pots.find(pot => pot.id === selectedId); if (!selected) throw Error('所选盆 ID 不存在。');
  const g = studyCaseGeometry(analysis); svg.replaceChildren();
  for (const group of g.groups) {
    add(svg, 'text', { x: 78, y: group.top - 21, class: 'case-plot-label' }, `处理 ${group.treatment} · 株高 (cm) · 6 盆`);
    for (const tick of g.ticks[group.index]) {
      add(svg, 'line', { x1: 78, x2: 627, y1: tick.y, y2: tick.y, stroke: '#dce5df' });
      add(svg, 'text', { x: 64, y: tick.y + 6, 'text-anchor': 'end', class: 'case-plot-tick' }, tick.text);
    }
    add(svg, 'line', { x1: 78, x2: 627, y1: group.meanY, y2: group.meanY, stroke: '#183a37', 'stroke-dasharray': '6 5', 'stroke-width': 2, 'data-case-group-mean': group.treatment });
    for (const pot of g.pots.filter(item => item.groupIndex === group.index)) {
      const chosen = pot.id === selectedId;
      if (chosen) add(svg, 'rect', { x: pot.x - 32, y: group.top - 4, width: 64, height: group.bottom - group.top + 8, fill: '#e8efea', opacity: .6, 'data-case-highlight': pot.id });
      for (const point of pot.points) add(svg, 'circle', { cx: point.x, cy: point.y, r: chosen ? 6 : 4.5, fill: '#086f68', stroke: chosen ? '#183a37' : '#fff', 'stroke-width': chosen ? 2 : 1,
        'data-case-point': point.id, 'data-selected': chosen });
      add(svg, 'line', { x1: pot.x - 24, x2: pot.x + 24, y1: pot.meanY, y2: pot.meanY, stroke: '#9a472e', 'stroke-width': chosen ? 4 : 3, 'data-case-pot-mean': pot.id });
      add(svg, 'text', { x: pot.x, y: group.bottom + 32, 'text-anchor': 'middle', class: 'case-plot-label', 'font-weight': chosen ? 700 : 400 }, pot.id);
    }
  }
  svg.setAttribute('aria-label', `36 株测量分属于 12 个花盆，处理 A、B 各六盆。上下两幅图共用株高纵轴 ${show(g.low)}–${show(g.high)} cm；每盆三个绿色圆点是 subsamples，棕色短线为该盆 mean，深色虚线为所属处理的六个盆 mean 的平均。选中 ${selected.id}，处理 ${selected.treatment}，原始值 ${selected.values.map(show).join('、')}，盆 mean=${show(selected.mean)} cm，组 mean=${show(selected.groupMean)} cm。`);
}

export function mountStudyCase(root) {
  if (root.dataset.studyCaseReady) return;
  const $ = selector => root.querySelector(selector), $$ = selector => [...root.querySelectorAll(selector)];
  const progress = $('[data-case-progress]');
  try {
    const dataElement = $('#study-case-data') || document.getElementById('study-case-data');
    const data = JSON.parse(dataElement?.textContent || 'null');
    const analysis = studyCaseAnalysis(data?.pots), questions = data.questions;
    if (!questions || typeof questions !== 'object' || Array.isArray(questions) || Object.keys(questions).length !== 6) throw Error('需要六道完整的学习检查。');
    Object.values(questions).forEach(validQuestion);
    const forms = $$('form[data-case-question]'), selectors = $$('[data-case-select]'), rows = $$('[data-pot-id]');
    if (forms.length !== 6 || new Set(forms.map(form => form.dataset.caseQuestion)).size !== 6 || forms.some(form => !Object.hasOwn(questions, form.dataset.caseQuestion))) throw Error('学习检查的正文与数据不匹配。');
    if (selectors.length !== 12 || new Set(selectors.map(button => button.value)).size !== 12 || selectors.some(button => !analysis.pots.some(pot => pot.id === button.value)) || rows.length !== 12 || new Set(rows.map(row => row.dataset.potId)).size !== 12 || rows.some(row => !analysis.pots.some(pot => pot.id === row.dataset.potId))) throw Error('花盆 ID 表格不完整。');
    for (const form of forms) {
      const inputs = [...form.querySelectorAll('input[type="radio"][name="answer"]')], question = questions[form.dataset.caseQuestion];
      if (!form.querySelector('[data-case-feedback]') || !inputs.length || new Set(inputs.map(input => input.value)).size !== inputs.length || inputs.some(input => !Object.hasOwn(question.feedback, input.value)) || !inputs.some(input => input.value === question.answer)) throw Error('学习检查的选项或反馈位置不完整。');
    }
    const visual = $('[data-case-visual]'), selectedText = $('[data-case-selected]'), reset = $('[data-case-reset]');
    if (!visual || !selectedText || !progress || !reset) throw Error('案例互动区域不完整。');
    root.classList.add('study-case-app');
    visual.innerHTML = `<label class="case-pot-control">选择一盆，追踪三株与盆 mean<select data-case-pot>${analysis.pots.map(pot => `<option value="${pot.id}">${pot.id} · 处理 ${pot.treatment}</option>`).join('')}</select></label><figure class="case-figure"><svg data-case-plot="main" viewBox="0 0 680 510" role="img"></svg><figcaption>两个处理使用同一纵轴。每盆三个绿色圆点是株测量，棕色短线是盆 mean，深色虚线是六个盆 mean 的组均值。选择一盆只改变追踪标记，不删改数据；点的水平错开只为辨识。</figcaption></figure><details class="case-zoom"><summary>放大查看全部 36 株与 12 盆</summary><div class="case-large-wrap" tabindex="0" role="region" aria-label="放大的花盆与株测量图，可横向滚动"><svg data-case-plot="large" viewBox="0 0 680 510" role="img"></svg></div></details>`;
    const potSelect = $('[data-case-pot]');
    let selectedId = 'P01'; if (!analysis.pots.some(pot => pot.id === selectedId)) selectedId = analysis.pots[0].id;
    function selectPot(id) {
      const pot = analysis.pots.find(item => item.id === id); if (!pot) { potSelect.value = selectedId; return; }
      selectedId = id; const group = analysis.groups.find(item => item.treatment === pot.treatment);
      potSelect.value = id;
      selectors.forEach(button => button.setAttribute('aria-pressed', String(button.value === id)));
      rows.forEach(row => row.setAttribute('data-selected', String(row.dataset.potId === id)));
      for (const size of ['main', 'large']) drawStudyCase($(`[data-case-plot="${size}"]`), analysis, id);
      selectedText.textContent = `${pot.id}，处理 ${pot.treatment}：三株观测为 [${pot.values.map(show).join(', ')}] cm；盆 mean=(${pot.values.map(show).join('+')})/3=${show(pot.mean)} cm。处理 ${pot.treatment} 的组均值=(${group.means.map(show).join('+')})/6=${show(group.mean)} cm；此盆在组均值中贡献 ${show(pot.mean)}/6≈${show(pot.meanContribution)} cm。三株用于描述这一盆，进入两组检验的是这个盆 mean，不是三个独立处理重复。`;
    }
    const states = new Map();
    function updateProgress() {
      const checked = [...states.values()].filter(state => state.status === 'checked'), correct = checked.filter(state => state.correct);
      progress.textContent = `本页当前已检查 ${checked.length}/6 题 · 当前答对 ${correct.length}/6 题。修改选项后需重新检查；本页记录不保存，刷新后重新开始。`;
    }
    for (const form of forms) {
      const id = form.dataset.caseQuestion, feedback = form.querySelector('[data-case-feedback]');
      const answer = () => new FormData(form).get('answer');
      const edited = () => {
        const previous = states.get(id), raw = answer();
        if (!previous || raw === previous.raw) return;
        states.set(id, { raw, status: 'edited', correct: false }); delete feedback.dataset.correct;
        feedback.textContent = '答案已修改，请重新检查；上一次判定不适用于当前选择。'; updateProgress();
      };
      form.addEventListener('input', edited); form.addEventListener('change', edited);
      form.addEventListener('submit', event => {
        event.preventDefault(); const raw = answer(), result = gradeCase(questions[id], raw);
        states.set(id, { raw, status: result.valid ? 'checked' : 'invalid', correct: result.correct });
        if (result.valid) { feedback.dataset.correct = String(result.correct); feedback.textContent = `${result.correct ? '答对了。' : '还需再想一想。'}${result.feedback}`; }
        else { delete feedback.dataset.correct; feedback.textContent = result.feedback; }
        updateProgress();
      });
    }
    reset.addEventListener('click', () => {
      forms.forEach(form => { form.reset(); const feedback = form.querySelector('[data-case-feedback]'); feedback.textContent = ''; delete feedback.dataset.correct; });
      states.clear(); updateProgress(); // The selected pot and its graph remain unchanged.
    });
    selectors.forEach(button => button.addEventListener('click', () => selectPot(button.value)));
    potSelect.addEventListener('change', () => selectPot(potSelect.value));
    selectPot(selectedId); updateProgress();
    forms.forEach(form => form.querySelectorAll('input,button').forEach(control => control.disabled = false));
    selectors.forEach(button => button.disabled = false); reset.disabled = false;
    root.dataset.studyCaseReady = 'true';
  } catch (error) {
    if (progress) progress.textContent = `互动暂未启用：${error.message} 正文、数据表、完整解析和 R 仍可阅读。`;
  }
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-study-case]').forEach(mountStudyCase);
