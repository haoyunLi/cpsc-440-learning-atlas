import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STUDENT_LIMIT, studentTheory, studentSummary, createStudentSimulation, studentRCode, studentIntervalGeometry, drawStudentIntervals, mountStudent } from '../assets/student.mjs';

const close = (a, b, tolerance = 2e-10) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} versus ${b}`);
const levels = [.90, .95, .99];
const theoryCases = Array.from({ length: 48 }, (_, i) => i + 3).flatMap(n => levels.map(level => ({ n, level })));
const dataCases = [
  ...[3, 5, 10, 30, 50].flatMap(n => {
    const sim = createStudentSimulation(n), records = sim.draw(10).records;
    return [records[0].values, records[9].values].flatMap(values => levels.map(level => ({ values, level })));
  }),
  ...levels.map(level => ({ values: [9.8, 10.3, 10.8, 11.3, 11.8], level })),
  { values: [10, 10, 10, 10, 10], level: .95 }
];

// Independent R definitions, including all supported n/level pairs. The
// exported code is executed too, rather than merely checking its text.
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-student-'));
try {
  const blocks = theoryCases.map(({ n, level }, i) => `local({
n_ref <- ${n}; level_ref <- ${level}
z_ref <- qnorm((1+level_ref)/2); t_ref <- qt((1+level_ref)/2,n_ref-1)
cat("STUTHEORY",${i},paste(sprintf("%.17g",c(z_ref,t_ref,2*pt(z_ref,n_ref-1)-1)),collapse=","),sep="\t");cat("\n")
})`);
  blocks.push(...dataCases.map(({ values, level }, i) => `local({
y_ref <- c(${values.join(',')}); level_ref <- ${level}
n_ref <- length(y_ref); mean_ref <- mean(y_ref); s_ref <- sd(y_ref)
kse_ref <- 2/sqrt(n_ref); ese_ref <- s_ref/sqrt(n_ref)
crit_ref <- c(qnorm((1+level_ref)/2),qnorm((1+level_ref)/2),qt((1+level_ref)/2,n_ref-1))
width_ref <- crit_ref*c(kse_ref,ese_ref,ese_ref)
interval_ref <- cbind(mean_ref-width_ref,mean_ref+width_ref)
if (s_ref==0) interval_ref[2:3,] <- NA_real_
values_ref <- c(mean_ref,s_ref,sum((y_ref-mean_ref)^2),kse_ref,ese_ref,
               (mean_ref-10)/kse_ref,if (s_ref>0) (mean_ref-10)/ese_ref else NA_real_,
               as.vector(t(interval_ref)))
cat("STUSAMPLE",${i},paste(sprintf("%.17g",values_ref),collapse=","),sep="\t");cat("\n")
invisible(capture.output({
${studentRCode(values, level)}
}))
stopifnot(identical(y,y_ref),n==n_ref,level==level_ref,
          isTRUE(all.equal(unname(intervals),unname(interval_ref),tolerance=1e-12)),
          abs(coverage[2]-(2*pt(qnorm((1+level_ref)/2),n_ref-1)-1))<1e-12)
})`));
  const path = join(temp, 'reference.R'); writeFileSync(path, blocks.join('\n'));
  const output = execFileSync(process.env.RSCRIPT || 'Rscript', [path], { encoding: 'utf8', maxBuffer: 2e6 });
  const theoryRows = output.split('\n').filter(line => line.startsWith('STUTHEORY\t'));
  assert.equal(theoryRows.length, theoryCases.length);
  theoryRows.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(Number), { n, level } = theoryCases[i], r = studentTheory(n, level);
    [r.zCritical, r.tCritical, r.naiveCoverage].forEach((value, j) => close(value, expected[j]));
    assert.equal(r.knownCoverage, level); assert.equal(r.tCoverage, level);
    assert.ok(r.naiveCoverage < level && r.naiveCoverage > 0); assert.ok(r.tCritical > r.zCritical);
  });
  const sampleRows = output.split('\n').filter(line => line.startsWith('STUSAMPLE\t')); assert.equal(sampleRows.length, dataCases.length);
  sampleRows.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(value => value === 'NA' ? null : Number(value));
    const { values, level } = dataCases[i], r = studentSummary(values, level);
    const actual = [r.mean, r.s, r.ss, r.knownSE, r.estimatedSE, r.Z, r.T, ...r.intervals.flatMap(method => [method.low, method.high])];
    actual.forEach((value, j) => value === null ? assert.equal(expected[j], null) : close(value, expected[j]));
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

const short = studentSummary([9.8, 10.3, 10.8, 11.3, 11.8]);
assert.deepEqual(short.intervals.map(method => method.covers), [true, false, true]);
assert.ok(short.intervals[2].halfWidth > short.intervals[1].halfWidth);
assert.ok(short.intervals[2].halfWidth < short.intervals[0].halfWidth); // t need not be wider than known-sigma z.
close(studentTheory(5).naiveCoverage, .8784403402128014);
const constant = studentSummary([10, 10, 10]);
assert.equal(constant.T, null); assert.equal(constant.s, 0);
assert.deepEqual(constant.intervals.map(method => method.available), [true, false, false]);

// Separate BigInt LCG and Box-Muller implementation checks the actual raw
// samples. Every observation consumes two uniforms, independently of grouping.
let integerState = 4405n;
function uniform() { integerState = (1664525n * integerState + 1013904223n) % (2n ** 32n); return (Number(integerState) + .5) / (2 ** 32); }
function nextNormal() { const u = uniform(), v = uniform(); return 10 + 2 * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const independent = Array.from({ length: 15 }, nextNormal), generated = createStudentSimulation(5).draw(3).records.flatMap(record => record.values);
assert.deepEqual(generated, independent);
for (const n of [3, 5, 50]) {
  const one = createStudentSimulation(n), batch = createStudentSimulation(n);
  for (let i = 0; i < 100; i++) one.draw();
  assert.deepEqual(one.snapshot(), batch.draw(100) && batch.snapshot());
  const original = batch.snapshot(); batch.setLevel(.99); batch.setLevel(.90); batch.setLevel(.95);
  assert.deepEqual(batch.snapshot(), original);
  assert.deepEqual(batch.draw().records, one.draw().records); // Level changes consume no RNG values.
  batch.reset(); assert.deepEqual(batch.draw(100).records, original.records);
}
const sim = createStudentSimulation(), control = createStudentSimulation(); sim.draw(401); control.draw(500);
const limit = sim.draw(100); assert.equal(limit.added, 99); assert.equal(limit.B, STUDENT_LIMIT); assert.equal(limit.remaining, 0); assert.equal(limit.totalObservations, 2500);
assert.deepEqual(limit.records, control.snapshot().records); sim.select(0); const capped = sim.snapshot();
assert.equal(sim.draw(100).added, 0); assert.deepEqual(sim.snapshot(), capped); // No silent reset or loss of selection.
const raw = capped.records.map(record => record.values); const higher = sim.setLevel(.99);
assert.deepEqual(higher.records.map(record => record.values), raw); assert.equal(higher.selected, 0);
higher.coverage.forEach((method, i) => { assert.equal(method.hits, higher.records.filter(record => record.intervals[i].covers).length); assert.ok(method.hits >= capped.coverage[i].hits); });
higher.records.forEach((record, i) => record.intervals.forEach((method, j) => assert.ok(method.halfWidth > capped.records[i].intervals[j].halfWidth)));
const beforeMutation = sim.snapshot(); const mutable = sim.snapshot(); mutable.records[0].values[0] = -999; mutable.records[0].theory.n = 100; mutable.current.intervals[0].low = -999; mutable.coverage[0].hits = 0;
assert.deepEqual(sim.snapshot(), beforeMutation);
for (const invalid of [0, 2, 51, 4.5, NaN, Infinity, '5']) {
  assert.throws(() => studentTheory(invalid)); assert.throws(() => createStudentSimulation(invalid));
  assert.throws(() => sim.reset(invalid)); assert.deepEqual(sim.snapshot(), beforeMutation);
}
for (const invalid of [0, .8, 1, NaN, '.95']) { assert.throws(() => sim.setLevel(invalid)); assert.deepEqual(sim.snapshot(), beforeMutation); }
for (const invalid of [0, -1, 501, 1.5, NaN]) { assert.throws(() => sim.draw(invalid)); assert.deepEqual(sim.snapshot(), beforeMutation); }
for (const invalid of [-1, 500, .5, NaN]) { assert.throws(() => sim.select(invalid)); assert.deepEqual(sim.snapshot(), beforeMutation); }
for (const invalid of [null, [], [1, 2], [1, 2, Infinity], [1, 2, '3'], [1, 2, 1e7]]) assert.throws(() => studentSummary(invalid));
const reset = sim.reset(3); assert.equal(reset.B, 0); assert.equal(reset.current, null); assert.equal(reset.level, .99); assert.equal(reset.selected, null);
assert.deepEqual(sim.draw(3).records, createStudentSimulation(3, .99).draw(3).records);

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.classList = { add() {} }; this.value = ''; this.disabled = false; this.hidden = false; this._text = ''; this._html = ''; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { (this.events[name] ??= []).push(callback); }
  async dispatch(name) { if (name === 'click' && this.disabled) return; for (const callback of this.events[name] || []) await callback(); }
  focus() { document.activeElement = this; }
}
const previousDocument = globalThis.document, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let copied = '', failCopy = false, waitCopy = false, resolveCopy = null;
globalThis.document = { activeElement: null, createElementNS: (namespace, tag) => new Element(tag) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (failCopy) throw Error('denied'); copied = text; if (waitCopy) await new Promise(resolve => { resolveCopy = resolve; }); } } } });
try {
  const graph = new Element('svg');
  for (const n of [3, 5, 50]) for (const level of levels) for (const sample of createStudentSimulation(n, level).draw(20).records) {
    const g = studentIntervalGeometry(sample); assert.ok(g.low < 10 && g.high > 10);
    assert.equal(new Set(g.ticks.map(tick => tick.text)).size, 5);
    for (const interval of sample.intervals) {
      assert.ok(g.x(interval.low) >= 155 && g.x(interval.high) <= 630);
      assert.ok(interval.low <= sample.mean && interval.high >= sample.mean);
    }
    drawStudentIntervals(graph, sample);
    assert.equal(graph.children.filter(el => 'data-stu-interval' in el.attrs).length, 3);
    assert.equal(graph.children.filter(el => 'data-stu-mean' in el.attrs).length, 3);
    assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    for (const el of graph.children) for (const key of ['x', 'x1', 'x2', 'cx']) if (key in el.attrs) assert.ok(Number(el.attrs[key]) >= 0 && Number(el.attrs[key]) <= 680);
  }
  drawStudentIntervals(graph, constant); assert.equal(graph.children.filter(el => 'data-stu-interval' in el.attrs).length, 1); assert.match(graph.attrs['aria-label'], /S=0/);
  drawStudentIntervals(graph, null); assert.equal(graph.children.length, 0); assert.match(graph.attrs['aria-label'], /尚无/);
  const elements = {};
  for (const key of ['n', 'n-value', 'level', 'select', 'error', 'status', 'valid', 'theory-note', 'index', 'current', 'values', 'calculation', 'pivots', 'plot', 'intervals', 'copy', 'code', 'copy-status']) elements[`[data-stu-${key}]`] = new Element();
  for (const key of ['one', 'hundred', 'reset']) elements[`[data-stu-action="${key}"]`] = new Element('button');
  for (const key of ['count', 'rate', 'theory']) for (let i = 0; i < 3; i++) elements[`[data-stu-${key}="${i}"]`] = new Element('td');
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-stu-${key}]`], action = key => elements[`[data-stu-action="${key}"]`];
  get('n').value = '5'; get('level').value = '.95'; mountStudent(root); mountStudent(root);
  assert.equal(action('one').events.click.length, 1); assert.equal(get('n').events.input.length, 1);
  assert.equal(get('current').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('select').disabled, true);
  assert.match(get('status').textContent, /B=0/); assert.match(get('theory-note').textContent, /87.844/);
  const stableInput = get('n'), stableSelector = get('select'), stableButton = action('hundred');
  action('one').focus(); await action('one').dispatch('click');
  assert.equal(document.activeElement, action('one')); assert.match(get('status').textContent, /B=1 组；nB=5/);
  const firstCode = get('code').textContent, firstRaw = get('values').innerHTML;
  assert.equal((firstRaw.match(/<li>/g) || []).length, 5); assert.equal(get('current').hidden, false);
  await action('hundred').dispatch('click'); assert.match(get('status').textContent, /B=101 组；nB=505/); assert.equal(get('select').value, '101');
  stableSelector.focus(); get('select').value = '1'; await get('select').dispatch('input');
  assert.equal(get('code').textContent, firstCode); assert.equal(get('values').innerHTML, firstRaw); assert.equal(document.activeElement, stableSelector);
  const firstGraph = JSON.stringify(get('plot').children);
  get('level').value = '.99'; await get('level').dispatch('change');
  assert.match(get('status').textContent, /B=101/); assert.equal(get('select').value, '1'); assert.equal(get('values').innerHTML, firstRaw);
  assert.notEqual(JSON.stringify(get('plot').children), firstGraph); assert.match(get('code').textContent, /level <- 0.99/);
  get('level').value = '.95'; await get('level').dispatch('change'); assert.equal(get('code').textContent, firstCode);
  for (let i = 0; i < 3; i++) await action('hundred').dispatch('click');
  assert.match(get('status').textContent, /B=401/); assert.equal(action('hundred').textContent, '重复剩余 99 组');
  await action('hundred').dispatch('click'); assert.match(get('status').textContent, /B=500.*本次新增 99 组.*上限/);
  assert.equal(action('hundred').disabled, true); assert.equal(action('one').disabled, true);
  const finalCode = get('code').textContent; await action('one').dispatch('click'); assert.equal(get('code').textContent, finalCode);
  get('level').value = '.9'; await get('level').dispatch('change'); assert.equal(action('one').disabled, true); assert.match(get('status').textContent, /B=500/);
  await get('copy').dispatch('click'); assert.equal(copied, get('code').textContent); assert.match(get('copy-status').textContent, /已复制/);
  failCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中上方/); failCopy = false;
  waitCopy = true; const pendingCopy = get('copy').dispatch('click'); get('select').value = '1'; await get('select').dispatch('input'); resolveCopy(); await pendingCopy; waitCopy = false;
  assert.equal(get('copy-status').textContent, '');
  get('level').value = '.95'; await get('level').dispatch('change'); await action('reset').dispatch('click');
  assert.equal(get('current').hidden, true); assert.equal(get('code').textContent, ''); assert.equal(action('one').disabled, false);
  await action('one').dispatch('click'); assert.equal(get('code').textContent, firstCode); // Reset replays the original seeded sample.
  get('n').focus(); get('n').value = '50'; await get('n').dispatch('input');
  assert.equal(document.activeElement, stableInput); assert.equal(get('n'), stableInput); assert.equal(get('select'), stableSelector); assert.equal(action('hundred'), stableButton);
  assert.match(get('status').textContent, /n=50.*B=0.*nB=0/); assert.equal(get('copy').disabled, true);
  await action('one').dispatch('click'); assert.equal((get('values').innerHTML.match(/<li>/g) || []).length, 50);
  for (const bad of ['', '2', '51', '3.5', 'NaN']) {
    get('n').value = bad; await get('n').dispatch('input');
    assert.equal(get('valid').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, ''); assert.equal(get('plot').children.length, 0);
    assert.equal(action('one').disabled, true); assert.match(get('error').textContent, /当前不显示旧结果/);
    get('n').value = '5'; await get('n').dispatch('input'); assert.equal(get('valid').hidden, false); assert.equal(action('one').disabled, false); assert.match(get('status').textContent, /B=0/);
  }
  await action('one').dispatch('click'); get('level').value = '.8'; await get('level').dispatch('change');
  assert.equal(get('valid').hidden, true); assert.equal(get('code').textContent, '');
  get('level').value = '.95'; await get('level').dispatch('change'); assert.equal(get('valid').hidden, false); assert.equal(get('code').textContent, firstCode);
  assert.match(root.innerHTML, /z 临界值 \+ 样本 S（近似）/); assert.match(root.innerHTML, /不一定比已知 σ/); assert.match(root.innerHTML, /独立正态/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log(`Student t: ${theoryCases.length} theoretical n/level pairs and ${dataCases.length} samples/exported R scripts matched independent R; raw RNG, batch/step equivalence, level-preserving records/RNG, reset replay, cap, geometry, stable controls and copy lifecycle passed.`);
