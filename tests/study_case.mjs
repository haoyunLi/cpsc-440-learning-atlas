import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { studyCaseAnalysis, gradeCase, studyCaseGeometry, drawStudyCase, mountStudyCase } from '../assets/study-case.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} versus ${b}`);
const data = JSON.parse(readFileSync(new URL('../content/study-case.json', import.meta.url), 'utf8'));
const expectedPots = [
  ['P01', 'A', [11, 12, 13]], ['P02', 'B', [15, 16, 17]], ['P03', 'B', [17, 18, 19]],
  ['P04', 'A', [13, 14, 15]], ['P05', 'A', [15, 16, 17]], ['P06', 'B', [19, 20, 21]],
  ['P07', 'A', [17, 18, 19]], ['P08', 'B', [21, 22, 23]], ['P09', 'B', [23, 24, 25]],
  ['P10', 'A', [19, 20, 21]], ['P11', 'B', [25, 26, 27]], ['P12', 'A', [21, 22, 23]]
].map(([id, treatment, values]) => ({ id, treatment, values }));
assert.deepEqual(data.pots, expectedPots); assert.equal(Object.keys(data.questions).length, 6);
const analysis = studyCaseAnalysis(data.pots), temp = mkdtempSync(join(tmpdir(), 'cpsc440-study-case-'));
try {
  const path = join(temp, 'reference.R');
  writeFileSync(path, `d <- data.frame(id=rep(c(${data.pots.map(pot => '"' + pot.id + '"').join(',')}),each=3),
                treatment=rep(c(${data.pots.map(pot => '"' + pot.treatment + '"').join(',')}),each=3),
                height=c(${data.pots.flatMap(pot => pot.values).join(',')}))
pots <- aggregate(height~id+treatment,data=d,FUN=mean)
group_means <- tapply(pots$height,pots$treatment,mean)
for (id in unique(d$id)) {
  own <- d[d$id==id,,drop=FALSE]
  m <- pots$height[pots$id==id]
  cat("CASEPOT",id,paste(sprintf("%.17g",c(sum(own$height),m,group_means[own$treatment[1]],m/6)),collapse=","),sep="\t");cat("\n")
}
for (kind in c("pot","naive")) {
  if (kind=="pot") { a <- pots$height[pots$treatment=="A"]; b <- pots$height[pots$treatment=="B"] }
  else { a <- d$height[d$treatment=="A"]; b <- d$height[d$treatment=="B"] }
  # The second calculation is deliberately the invalid pseudoreplication
  # diagnostic, not a method proposed for reporting the actual experiment.
  test <- t.test(b,a,var.equal=FALSE)
  values <- c(length(b),length(a),mean(b),mean(a),var(b),var(a),mean(b)-mean(a),
              test$stderr,unname(test$parameter),unname(test$statistic),test$p.value,
              unname(test$conf.int))
  cat("CASETEST",kind,paste(sprintf("%.17g",values),collapse=","),sep="\t");cat("\n")
}
`);
  const stdout = execFileSync(process.env.RSCRIPT || 'Rscript', [path], { encoding: 'utf8', maxBuffer: 1e6 });
  const potLines = stdout.split('\n').filter(line => line.startsWith('CASEPOT\t')); assert.equal(potLines.length, 12);
  for (const line of potLines) {
    const [, id, values] = line.split('\t'), r = analysis.pots.find(pot => pot.id === id);
    const expected = values.split(',').map(Number); [r.sum, r.mean, r.groupMean, r.meanContribution].forEach((value, i) => close(value, expected[i]));
  }
  const testLines = stdout.split('\n').filter(line => line.startsWith('CASETEST\t')); assert.equal(testLines.length, 2);
  for (const line of testLines) {
    const [, kind, values] = line.split('\t'), r = kind === 'pot' ? analysis.welch : analysis.naive;
    const actual = [r.n1, r.n2, r.meanA, r.meanB, r.varA, r.varB, r.estimate, r.se, r.df, r.t, r.p, r.low, r.high];
    values.split(',').map(Number).forEach((value, i) => close(actual[i], value));
  }
} finally { rmSync(temp, { recursive: true, force: true }); }

assert.deepEqual(analysis.groups.map(group => group.means), [[12, 14, 16, 18, 20, 22], [16, 18, 20, 22, 24, 26]]);
assert.deepEqual(analysis.groups.map(group => group.mean), [17, 21]); assert.equal(analysis.direction, 'B − A');
assert.equal(analysis.welch.estimate, 4); assert.equal(analysis.naive.estimate, 4);
assert.equal(analysis.welch.df, 10); assert.equal(analysis.naive.df, 34);
close(analysis.welch.p, .09379255157922324); close(analysis.naive.p, .0021526918210556076);
assert.ok(analysis.welch.low < 0 && analysis.naive.low > 0); assert.ok(analysis.welch.se > analysis.naive.se);
assert.equal(analysis.naive.validInference, false); assert.equal(analysis.naive.diagnosticOnly, true); assert.match(analysis.naive.label, /伪重复.*不能.*正式/);
assert.equal(analysis.potCount, 12); assert.equal(analysis.plantCount, 36);
for (const group of analysis.groups) {
  assert.equal(group.n, 6); assert.equal(group.plantCount, 18);
  close(analysis.pots.filter(pot => pot.treatment === group.treatment).reduce((sum, pot) => sum + pot.meanContribution, 0), group.mean);
}
const reverse = studyCaseAnalysis([...data.pots].reverse());
for (const key of ['estimate', 'se', 'df', 't', 'p', 'low', 'high']) { close(reverse.welch[key], analysis.welch[key]); close(reverse.naive[key], analysis.naive[key]); }
const mutable = studyCaseAnalysis(data.pots); mutable.pots[0].values[0] = 99; mutable.groups[0].means[0] = 99;
assert.deepEqual(data.pots, expectedPots); assert.deepEqual(studyCaseAnalysis(data.pots), analysis);
const clone = value => JSON.parse(JSON.stringify(value));
for (const malformed of [null, [], data.pots.slice(1), [...data.pots, data.pots[0]]]) assert.throws(() => studyCaseAnalysis(malformed));
for (const change of [p => p[0].id = 'P02', p => p[0].id = '', p => p[0].treatment = 'C', p => p[0].treatment = 'B', p => p[0].values.pop(), p => p[0].values[0] = Infinity, p => p[0].values[0] = '11']) {
  const pots = clone(data.pots); change(pots); assert.throws(() => studyCaseAnalysis(pots));
}
for (const question of Object.values(data.questions)) {
  for (const [value, feedback] of Object.entries(question.feedback)) assert.deepEqual(gradeCase(question, value), { valid: true, correct: value === question.answer, feedback });
  for (const value of [null, undefined, '', ' ', 1, 'not-an-option']) assert.equal(gradeCase(question, value).valid, false);
}
for (const question of [null, {}, { answer: 'a', feedback: {} }, { answer: 'a', feedback: { a: '' } }, { answer: 'a', feedback: { a: 1 } }]) assert.throws(() => gradeCase(question, 'a'));

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.classList = { add() {} }; this.selectors = {}; this.lists = {}; this.value = ''; this.disabled = true; this.hidden = false; this._text = ''; this._html = ''; this.answer = null; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { (this.events[name] ??= []).push(callback); }
  querySelector(selector) { return this.selectors[selector] || null; }
  querySelectorAll(selector) { return this.lists[selector] || []; }
  async dispatch(name) { if (name === 'click' && this.disabled) return; const event = { currentTarget: this, preventDefault() { this.prevented = true; } }; for (const callback of this.events[name] || []) await callback(event); return event; }
  focus() { document.activeElement = this; }
  reset() { this.answer = null; }
}
const previousDocument = globalThis.document, previousFormData = globalThis.FormData;
globalThis.document = { activeElement: null, createElementNS: (namespace, tag) => new Element(tag), getElementById: () => null };
globalThis.FormData = class { constructor(form) { this.form = form; } get() { return this.form.answer; } };
function fixture(payload = data) {
  const root = new Element(), elements = {}, forms = [], selectors = [], rows = [];
  root.innerHTML = 'Static narrative, source data and complete explanations are retained.';
  for (const key of ['progress', 'visual', 'selected', 'reset', 'pot']) elements[`[data-case-${key}]`] = new Element();
  for (const size of ['main', 'large']) elements[`[data-case-plot="${size}"]`] = new Element('svg');
  const json = elements['#study-case-data'] = new Element('script'); json.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const pot of data.pots) {
    const button = new Element('button'); button.value = pot.id; selectors.push(button);
    const row = new Element('tr'); row.dataset.potId = pot.id; rows.push(row);
  }
  for (const [id, question] of Object.entries(data.questions)) {
    const form = new Element('form'); form.dataset.caseQuestion = id;
    const inputs = Object.keys(question.feedback).map(value => { const input = new Element('input'); input.value = value; return input; });
    const submit = new Element('button'), feedback = new Element('p'); form.selectors['[data-case-feedback]'] = feedback;
    form.lists['input[type="radio"][name="answer"]'] = inputs; form.lists['input,button'] = [...inputs, submit]; forms.push(form);
  }
  root.selectors = elements; root.lists = { 'form[data-case-question]': forms, '[data-case-select]': selectors, '[data-pot-id]': rows };
  return { root, elements, forms, selectors, rows, get: key => elements[`[data-case-${key}]`] };
}
try {
  const graph = new Element('svg'), geometry = studyCaseGeometry(analysis); assert.deepEqual([geometry.low, geometry.high], [8, 30]);
  for (const pot of analysis.pots) {
    drawStudyCase(graph, analysis, pot.id);
    const points = graph.children.filter(el => 'data-case-point' in el.attrs), means = graph.children.filter(el => 'data-case-pot-mean' in el.attrs);
    assert.equal(points.length, 36); assert.equal(means.length, 12); assert.equal(new Set(points.map(el => el.attrs['data-case-point'])).size, 36);
    assert.equal(points.filter(el => el.attrs['data-selected'] === 'true').length, 3);
    assert.equal(graph.children.filter(el => 'data-case-highlight' in el.attrs).length, 1); assert.equal(graph.children.filter(el => 'data-case-group-mean' in el.attrs).length, 2);
    for (const original of geometry.pots) {
      const group = geometry.groups[original.groupIndex];
      for (const point of original.points) {
        const node = points.find(el => el.attrs['data-case-point'] === point.id), radius = Number(node.attrs.r);
        close(Number(node.attrs.cx), point.x); close(Number(node.attrs.cy), point.y);
        assert.ok(point.x - radius > 78 && point.x + radius < 627 && point.y - radius > group.top && point.y + radius < group.bottom);
      }
      const marker = means.find(el => el.attrs['data-case-pot-mean'] === original.id); close(Number(marker.attrs.y1), original.meanY);
    }
    assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    assert.match(graph.attrs['aria-label'], new RegExp(`选中 ${pot.id}`)); assert.match(graph.attrs['aria-label'], /cm/);
  }
  assert.throws(() => drawStudyCase(graph, analysis, 'P99'));
  const app = fixture(), { root, get, forms, selectors, rows, elements } = app;
  mountStudyCase(root); mountStudyCase(root);
  assert.equal(root.innerHTML, 'Static narrative, source data and complete explanations are retained.');
  assert.equal(selectors[0].events.click.length, 1); assert.equal(forms[0].events.submit.length, 1);
  assert.ok(selectors.every(button => !button.disabled)); assert.ok(forms.every(form => form.lists['input,button'].every(control => !control.disabled)));
  assert.equal(selectors[0].attrs['aria-pressed'], 'true'); assert.match(get('selected').textContent, /P01.*\[11, 12, 13\].*\/3=12 cm.*\/6=17 cm.*12\/6≈2 cm/);
  assert.equal(get('pot').value, 'P01'); assert.equal(get('pot').events.change.length, 1);
  assert.equal((get('visual').innerHTML.match(/<option value=/g) || []).length, 12);
  assert.match(get('progress').textContent, /已检查 0\/6.*答对 0\/6/);
  const stableButton = selectors[10], stableRow = rows[10]; stableButton.focus(); await stableButton.dispatch('click');
  assert.equal(document.activeElement, stableButton); assert.equal(selectors[10], stableButton); assert.equal(rows[10], stableRow);
  assert.equal(stableRow.attrs['data-selected'], 'true'); assert.match(get('selected').textContent, /P11.*\[25, 26, 27\].*\/3=26 cm.*\/6=21 cm/);
  assert.equal(get('pot').value, 'P11');
  const stableSelect = get('pot'); stableSelect.focus(); stableSelect.value = 'P04'; await stableSelect.dispatch('change');
  assert.equal(document.activeElement, stableSelect); assert.equal(get('pot'), stableSelect);
  assert.equal(selectors[3].attrs['aria-pressed'], 'true'); assert.equal(rows[3].attrs['data-selected'], 'true'); assert.equal(selectors[10].attrs['aria-pressed'], 'false');
  assert.match(get('selected').textContent, /^P04/); assert.match(elements['[data-case-plot="main"]'].attrs['aria-label'], /选中 P04/);
  stableSelect.value = 'P99'; await stableSelect.dispatch('change'); assert.equal(stableSelect.value, 'P04'); assert.match(get('selected').textContent, /^P04/);
  await stableButton.dispatch('click'); assert.equal(stableSelect.value, 'P11');
  assert.equal(JSON.stringify(elements['[data-case-plot="main"]'].children), JSON.stringify(elements['[data-case-plot="large"]'].children));
  const form = forms[0], question = data.questions[form.dataset.caseQuestion], feedback = form.querySelector('[data-case-feedback]');
  const emptyEvent = await form.dispatch('submit'); assert.equal(emptyEvent.prevented, true); assert.match(feedback.textContent, /先选择/); assert.equal(feedback.dataset.correct, undefined); assert.match(get('progress').textContent, /已检查 0\/6/);
  const wrong = Object.keys(question.feedback).find(value => value !== question.answer); form.answer = wrong; await form.dispatch('change'); await form.dispatch('submit');
  assert.equal(feedback.dataset.correct, 'false'); assert.match(feedback.textContent, /还需再想/); assert.ok(feedback.textContent.includes(question.feedback[wrong])); assert.match(get('progress').textContent, /已检查 1\/6.*答对 0\/6/);
  form.answer = question.answer; await form.dispatch('input'); assert.equal(feedback.dataset.correct, undefined); assert.match(feedback.textContent, /答案已修改/); assert.match(get('progress').textContent, /已检查 0\/6/);
  await form.dispatch('submit'); assert.equal(feedback.dataset.correct, 'true'); assert.match(get('progress').textContent, /已检查 1\/6.*答对 1\/6/);
  await form.dispatch('change'); assert.equal(feedback.dataset.correct, 'true'); // A same-value change after submission is not an edit.
  for (const other of forms.slice(1)) { other.answer = data.questions[other.dataset.caseQuestion].answer; await other.dispatch('submit'); }
  assert.match(get('progress').textContent, /已检查 6\/6.*答对 6\/6/);
  const allDone = get('progress').textContent; await selectors[0].dispatch('click'); assert.equal(get('progress').textContent, allDone);
  form.answer = wrong; await form.dispatch('change'); assert.equal(feedback.dataset.correct, undefined); assert.match(get('progress').textContent, /已检查 5\/6.*答对 5\/6/);
  await selectors[10].dispatch('click'); const selectedText = get('selected').textContent, selectedGraph = JSON.stringify(elements['[data-case-plot="main"]'].children);
  await get('reset').dispatch('click'); assert.match(get('progress').textContent, /已检查 0\/6.*答对 0\/6/);
  assert.equal(get('selected').textContent, selectedText); assert.equal(JSON.stringify(elements['[data-case-plot="main"]'].children), selectedGraph); assert.equal(selectors[10].attrs['aria-pressed'], 'true');
  assert.equal(get('pot').value, 'P11');
  assert.ok(forms.every(item => item.answer === null && item.querySelector('[data-case-feedback]').textContent === '' && item.querySelector('[data-case-feedback]').dataset.correct === undefined));
  for (const payload of ['not JSON', null, { pots: data.pots, questions: {} }, { pots: data.pots.slice(1), questions: data.questions }]) {
    const bad = fixture(payload); mountStudyCase(bad.root); assert.equal(bad.root.dataset.studyCaseReady, undefined);
    assert.ok(bad.selectors.every(button => button.disabled)); assert.ok(bad.forms.every(item => item.lists['input,button'].every(control => control.disabled)));
    assert.match(bad.get('progress').textContent, /互动暂未启用.*仍可阅读/); assert.equal(bad.root.innerHTML, 'Static narrative, source data and complete explanations are retained.');
  }
  const incomplete = fixture(); incomplete.forms[0].lists['input[type="radio"][name="answer"]'][0].value = 'missing-feedback'; mountStudyCase(incomplete.root);
  assert.match(incomplete.get('progress').textContent, /选项或反馈/); assert.ok(incomplete.selectors.every(button => button.disabled));
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  globalThis.FormData = previousFormData;
}
console.log('Study case: independent R aggregation and valid/explicitly-invalid Welch calculations, all 12 pots and 36 points, group-mean contributions, static schema agreement, six-question edit/recheck/reset lifecycle, stable controls and failure-safe disabled forms passed.');
