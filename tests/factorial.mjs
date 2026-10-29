import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { factorialSummary, factorialRCode, drawFactorial, mountFactorial } from '../assets/factorial.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const initial = { means: [10, 12, 14, 20], sizes: [2, 2, 2, 2] };
const example = { means: [10, 12, 20, 18], sizes: [9, 2, 1, 2] };
const reversed = { ...example, sizes: [1, 2, 9, 2] };
const commonWeights = { ...example, sizes: [3, 6, 1, 2] };
const doubledCounts = { ...example, sizes: [6, 12, 2, 4] };
const cases = [initial, example, reversed, commonWeights, doubledCounts,
  { means: [5, 5, 5, 5], sizes: [1, 30, 30, 1] },
  { means: [28, 28, 28, 28], sizes: [30, 1, 1, 30] },
  { means: [5, 28, 28, 5], sizes: [1, 30, 1, 30] },
  ...Array.from({ length: 30 }, (_, i) => ({ means: [0, 1, 2, 3].map(j => 5 + (i * 7 + j * 11) % 24), sizes: [0, 1, 2, 3].map(j => 1 + (i * 13 + j * 7) % 30) }))];
const flatten = r => [...r.simple, r.interaction, r.equalDifference, r.rawDifference, r.equalFertilizer];
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-factorial-'));
try {
  // Independently map the input cells and use weighted.mean; also execute the
  // exact exported R code, without synthesizing any individual observations.
  const script = cases.map((settings, i) => `local({
m <- c(${settings.means.join(',')}); counts <- c(${settings.sizes.join(',')})
v1 <- m[c(1,3)]; v2 <- m[c(2,4)]
raw1 <- weighted.mean(v1,counts[c(1,3)])
raw2 <- weighted.mean(v2,counts[c(2,4)])
expected <- c(v2-v1,diff(v2-v1),mean(v2)-mean(v1),raw2-raw1,mean(m[c(3,4)])-mean(m[c(1,2)]))
cat("FACTORIAL",${i},paste(sprintf("%.17g",expected),collapse=","),sep="\t");cat("\n")
invisible(capture.output({
${factorialRCode(settings)}
}))
stopifnot(max(abs(unname(result)-expected))<1e-12)
})`).join('\n');
  const file = join(temp, 'reference.R'); writeFileSync(file, script);
  const stdout = execFileSync(process.env.RSCRIPT || 'Rscript', [file], { encoding: 'utf8', maxBuffer: 2e6 });
  const rows = stdout.split('\n').filter(line => line.startsWith('FACTORIAL\t'));
  assert.equal(rows.length, cases.length);
  rows.forEach((line, i) => line.split('\t')[2].split(',').map(Number).forEach((expected, j) => close(flatten(factorialSummary(cases[i]))[j], expected)));
} finally { rmSync(temp, { recursive: true, force: true }); }

const start = factorialSummary(initial), before = factorialSummary(example), after = factorialSummary(reversed);
assert.deepEqual(flatten(start), [2, 6, 4, 4, 4, 6]);
assert.deepEqual(flatten(before), [2, -2, -4, 0, 4, 8]);
assert.deepEqual(flatten(after), [2, -2, -4, 0, -4, 8]);
assert.deepEqual(before.groups.map(group => group.raw), [11, 15]);
assert.deepEqual(after.groups.map(group => group.raw), [19, 15]);
assert.deepEqual(before.groups.map(group => group.equal), [15, 15]);
assert.deepEqual(before.groups.map(group => group.weights), [[.9, .1], [.5, .5]]);
// Equal cell counts are not required for a common-weight comparison. Both
// varieties can share the same 3:1 composition while having different totals.
const common = factorialSummary(commonWeights), doubled = factorialSummary(doubledCounts);
assert.deepEqual(common.groups.map(group => group.weights), [[.75, .25], [.75, .25]]);
assert.equal(common.rawDifference, .75 * common.simple[0] + .25 * common.simple[1]);
assert.equal(common.rawDifference, 1); assert.equal(common.equalDifference, 0);
assert.deepEqual(flatten(doubled), flatten(common)); assert.equal(doubled.N, 2 * common.N);
assert.equal('se' in doubled, false); assert.equal('p' in doubled, false);
for (const settings of cases) {
  const r = factorialSummary(settings);
  assert.equal(r.N, settings.sizes.reduce((a, b) => a + b, 0));
  close(r.equalDifference, (r.simple[0] + r.simple[1]) / 2);
  r.groups.forEach(group => {
    close(group.weights.reduce((a, b) => a + b), 1);
    for (const method of ['raw', 'equal']) {
      assert.ok(group[method] >= Math.min(...group.means) - 1e-12 && group[method] <= Math.max(...group.means) + 1e-12);
      close(group[`${method}Terms`].reduce((a, b) => a + b), group[method]);
    }
  });
  const multiplier = factorialSummary({ ...settings, sizes: [2, 2, 2, 2] });
  close(multiplier.rawDifference, multiplier.equalDifference);
}
for (const means of [[], [10, 12, 14], [4, 12, 14, 20], [10, 12, 14, 29], [10.5, 12, 14, 20], [NaN, 12, 14, 20], ['10', 12, 14, 20]]) assert.throws(() => factorialSummary({ ...initial, means }), /means/);
for (const sizes of [[], [2, 2, 2], [0, 2, 2, 2], [2, 31, 2, 2], [2, 2, 1.5, 2], [2, 2, 2, Infinity], ['2', 2, 2, 2]]) {
  assert.throws(() => factorialSummary({ ...initial, sizes }), /n/);
  assert.throws(() => factorialRCode({ ...initial, sizes }), /n/);
}
const immutable = factorialSummary(initial); immutable.means[0] = 20; immutable.sizes[0] = 30;
assert.deepEqual(initial, { means: [10, 12, 14, 20], sizes: [2, 2, 2, 2] });

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.style = {}; this.classList = { add() {} }; this.value = ''; this.disabled = false; this.hidden = false; this._text = ''; this._html = ''; }
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
let copied = '', rejectCopy = false, pendingResolve = null, shouldWait = false;
globalThis.document = { activeElement: null, createElementNS: (namespace, tag) => new Element(tag) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (rejectCopy) throw Error('denied'); copied = text; if (shouldWait) await new Promise(resolve => { pendingResolve = resolve; }); } } } });
try {
  const plot = new Element('svg');
  for (const settings of cases) {
    drawFactorial(plot, factorialSummary(settings));
    const points = plot.children.filter(el => 'data-fact-point' in el.attrs);
    assert.equal(points.length, 4); assert.equal(plot.children.filter(el => 'data-fact-line' in el.attrs).length, 2);
    points.forEach(point => {
      const x = point.tag === 'circle' ? +point.attrs.cx : +point.attrs.x + 6;
      const y = point.tag === 'circle' ? +point.attrs.cy : +point.attrs.y + 6;
      assert.ok(x >= 82 && x <= 598 && y >= 46 && y <= 254);
    });
    assert.ok(plot.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    assert.equal(new Set(plot.children.filter(el => el.attrs.class === 'fact-tick').map(el => el.textContent)).size, 5);
  }
  drawFactorial(plot, before); const originalPlot = JSON.stringify(plot);
  drawFactorial(plot, after); assert.equal(JSON.stringify(plot), originalPlot, 'n alone must not move the cell-mean plot');

  const elements = {};
  const ids = ['f11', 'f21', 'f12', 'f22', 'fn11', 'fn21', 'fn12', 'fn22'];
  ids.forEach((id, i) => { elements[`#${id}`] = Object.assign(new Element('input'), { value: String(i < 4 ? initial.means[i] : 2) }); });
  ids.slice(0, 4).forEach(id => { elements[`#${id}-v`] = new Element('output'); });
  for (const key of ['error', 'operation', 'results', 'plot', 'readout', 'weights', 'copy', 'code', 'copy-status']) elements[`[data-fact-${key}]`] = new Element(key === 'plot' ? 'svg' : 'div');
  for (const key of ['example', 'reverse', 'reset']) elements[`[data-fact-action="${key}"]`] = new Element('button');
  for (const i of [0, 1]) for (const method of ['raw', 'equal']) {
    for (const name of ['bar', 'formula']) elements[`[data-fact-${name}="${i}-${method}"]`] = new Element();
    for (const j of [0, 1]) elements[`[data-fact-term="${i}-${method}-${j}"]`] = new Element('span');
  }
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-fact-${key}]`], action = key => elements[`[data-fact-action="${key}"]`];
  mountFactorial(root); mountFactorial(root);
  assert.equal(elements['#f11'].events.input.length, 1); assert.equal(action('reverse').events.click.length, 1);
  assert.match(root.innerHTML, /样本数变化仍可能改变估计精度/); assert.match(root.innerHTML, /并不是唯一自然正确/);
  ids.forEach(id => assert.equal((root.innerHTML.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1));
  assert.match(get('readout').textContent, /I=high−low=4.*等权 variety 差=4.*raw variety 差=4/);
  await action('example').dispatch('click'); assert.match(get('readout').textContent, /I=high−low=-4.*等权 variety 差=0.*raw variety 差=4/);
  const stableControls = ids.map(id => elements[`#${id}`]), graphBefore = JSON.stringify(get('plot'));
  elements['#fn11'].focus(); await action('reverse').dispatch('click');
  assert.equal(elements['#fn11'].value, '1'); assert.equal(elements['#fn12'].value, '9');
  assert.equal(JSON.stringify(get('plot')), graphBefore); assert.equal(document.activeElement, elements['#fn11']);
  assert.deepEqual(ids.map(id => elements[`#${id}`]), stableControls);
  assert.match(get('readout').textContent, /raw variety 差=-4/);
  for (const i of [0, 1]) for (const method of ['raw', 'equal']) {
    const widths = [0, 1].map(j => parseFloat(elements[`[data-fact-term="${i}-${method}-${j}"]`].style.width));
    assert.ok(widths.every(width => width > 0 && Number.isFinite(width)));
    assert.ok(widths[0] + widths[1] <= 100 + 1e-12);
    close((widths[0] + widths[1]) * .28, after.groups[i][method]);
  }
  await get('copy').dispatch('click'); assert.equal(copied, factorialRCode(reversed)); assert.match(get('copy-status').textContent, /已复制/);
  rejectCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中/); rejectCopy = false;
  shouldWait = true; const pendingCopy = get('copy').dispatch('click'); await action('reset').dispatch('click'); pendingResolve(); await pendingCopy; shouldWait = false;
  assert.equal(get('copy-status').textContent, ''); assert.equal(elements['#f12'].value, '14'); assert.equal(elements['#fn11'].value, '2');
  for (const invalid of ['', ' ', '0', '-1', '31', '2.5', 'NaN', 'Infinity', '2x']) {
    elements['#fn11'].value = invalid; await elements['#fn11'].dispatch('input');
    assert.equal(get('results').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, '');
    assert.equal(get('plot').children.length, 0); assert.match(get('error').textContent, /1–30/);
    await action('reverse').dispatch('click'); assert.equal(elements['#fn11'].value, invalid); assert.match(get('error').textContent, /未改变/);
    await action('example').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(get('copy').disabled, false);
  }
  elements['#f22'].focus(); elements['#f22'].value = '28'; await elements['#f22'].dispatch('input');
  assert.equal(document.activeElement, elements['#f22']); assert.equal(elements['#f22-v'].textContent, '28');
  assert.match(get('readout').textContent, /I=high−low=6/); assert.notEqual(JSON.stringify(get('plot')), graphBefore);
  elements['#fn11'].value = '1'; elements['#fn12'].value = '30'; await elements['#fn12'].dispatch('input');
  assert.match(elements['[data-fact-formula="0-raw"]'].textContent, /1\/31 × 10 \+ 30\/31 × 20 ≈ 19.67742/);
  assert.match(elements['[data-fact-formula="0-equal"]'].textContent, /1\/2 × 10 \+ 1\/2 × 20 = 15/);
  assert.match(root.innerHTML, /计算使用完整权重/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log(`Factorial: ${cases.length} independent base R scenarios and executable exported scripts; target/composition identities, input bounds, finite plots, invariant cell geometry, stable controls, error recovery and copy lifecycle passed.`);
