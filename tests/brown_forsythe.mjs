import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brownForsythe, parseBFGroup, transformBFGroup, bfAxis, brownForsytheRCode, drawBrownForsythe, mountBrownForsythe } from '../assets/brown-forsythe.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const cases = [
  [[2, 3, 4], [1, 3, 5]], [[2, 3, 4], [101, 103, 105]], [[2, 3, 4], [-1, 3, 7]],
  [[-5, -2, 0, 2], [1, 1, 3, 7, 9]], [[0, 2, 2, 4], [10, 14, 14, 18]],
  [[1, 3], [0, 1, 4]], [[0, 0, 0], [0, 1, 4]], [[1, 2, 3], [1, 2, 3]],
  [[2, 3, 4].map(x => x * 1e-9), [1, 3, 5].map(x => x * 1e-9)],
  [[2, 3, 4].map(x => x * 1e-200), [1, 3, 5].map(x => x * 1e-200)],
  [[2, 3, 4].map(x => x + 999980), [1, 3, 5].map(x => x + 999980)],
  [Array.from({ length: 50 }, (_, i) => (i * 7 % 19) - 10), Array.from({ length: 37 }, (_, i) => (i * 11 % 23) + 10)],
  [[.1, .1, .1], [.2, .2, .2, .2]], [[1, 3], [2, 8]],
  [[-1, -1, 1, 1], [-3, -3, 3, 3]], [[.1, .3], [.2, .6]]
];
// Base R independently constructs the median deviations, then fits their
// normalized response with aov. Degenerate data are identified before fitting:
// QR roundoff alone can otherwise yield an enormous F for exactly zero MSE.
const blocks = cases.map(([a, b], index) => `local({
a <- c(${a.join(',')}); b <- c(${b.join(',')})
g <- factor(rep(c("A","B"),c(length(a),length(b))))
y <- c(a,b); centers <- c(median(a),median(b))
z <- abs(y-ave(y,g,FUN=median)); zmeans <- as.numeric(tapply(z,g,mean))
scale <- max(z); zs <- if (scale>0) z/scale else rep(0,length(z))
res <- zs-ave(zs,g,FUN=mean); ssE <- sum(res^2)
ok <- scale>0 && sqrt(ssE/(length(z)-2))>32*.Machine$double.eps
f <- p <- NA_real_
ssB <- sum(as.numeric(table(g))*(as.numeric(tapply(zs,g,mean))-mean(zs))^2)
if (ok) { tab <- summary(aov(zs~g))[[1]]; f <- tab[1,"F value"]; p <- tab[1,"Pr(>F)"] }
cat("BFREF",${index},paste(sprintf("%.17g",c(centers,zmeans,ssB,ssE,ok,f,p)),collapse=","),sep="\\t");cat("\\n")
invisible(capture.output(suppressMessages({
${brownForsytheRCode(a, b)}
})))
stopifnot(identical(available,ok))
if (ok) stopifnot(abs(f_value-f)<1e-10,abs(p_value-p)<1e-10)
})`);
// Rscript -e truncates long expressions; run the complete reference script.
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-bf-'));
let stdout;
try {
  const script = join(temp, 'reference.R'); writeFileSync(script, blocks.join('\n'));
  stdout = execFileSync(process.env.RSCRIPT || 'Rscript', [script], { encoding: 'utf8', maxBuffer: 2e6 });
} finally { rmSync(temp, { recursive: true, force: true }); }
const refs = stdout.split('\n').filter(line => line.startsWith('BFREF\t'));
assert.equal(refs.length, cases.length);
refs.forEach((line, index) => {
  const expected = line.split('\t')[2].split(',').map(Number), result = brownForsythe(...cases[index]);
  const actual = [...result.medians, ...result.zMeans, result.ssBetweenScaled, result.ssWithinScaled];
  actual.forEach((value, i) => close(value, expected[i], Math.max(Number.MIN_VALUE, 1e-11 * Math.max(Math.abs(value), Math.abs(expected[i])))));
  assert.equal(result.estimable, Boolean(expected[6]));
  if (result.estimable) { close(result.f, expected[7]); close(result.p, expected[8]); }
  else { assert.equal(result.f, null); assert.equal(result.p, null); assert.match(result.reason, /MSE/); }
  assert.equal(result.dfWithin, result.N - 2); assert.equal(result.rows.length, result.N);
});
const base = brownForsythe(...cases[0]);
close(base.f, .8); close(base.p, .421648255176194); close(base.ssBetween, 2 / 3); close(base.ssWithin, 10 / 3); close(base.mse, 5 / 6);
assert.deepEqual(base.groups.map(group => group.map(row => row.z)), [[1, 0, 1], [2, 0, 2]]);
assert.deepEqual(base.groups.map(group => group.map(row => row.y)), cases[0]);
const shifted = brownForsythe(cases[0][0], transformBFGroup(cases[0][1], 'shift'));
assert.deepEqual(shifted.groups[1].map(row => row.z), base.groups[1].map(row => row.z));
assert.equal(shifted.f, base.f); assert.equal(shifted.p, base.p);
const spread = brownForsythe(cases[0][0], transformBFGroup(cases[0][1], 'spread'));
assert.deepEqual(spread.groups[1].map(row => row.y), [-1, 3, 7]); close(spread.f, 36 / 17); close(spread.p, .21930692358453635);
assert.equal(spread.medians[1], base.medians[1]);
assert.equal(brownForsythe([1, 2, 3], [1, 2, 3]).p, 1);
for (const factor of [1e-9, 1e-200, 1000]) {
  const scaled = brownForsythe(...cases[0].map(group => group.map(value => factor * value)));
  close(scaled.f, base.f); close(scaled.p, base.p);
  assert.ok(scaled.text.mse !== '0' && scaled.text.within !== '0');
}
assert.equal(brownForsythe(...cases[9]).text.mse, '8.3333333e-401');
assert.throws(() => transformBFGroup([1e-20, 2e-20, 3e-20], 'shift'), /浮点精度/);
assert.throws(() => transformBFGroup([999999, 1000000], 'shift'), /1e6/);
assert.throws(() => transformBFGroup([-1e6, 1e6], 'spread'), /1e6/);
for (const input of ['', '1', '1,NaN', '1,Infinity', 'a,b', '0x10,2', '1,1000001', Array(51).fill(1).join(',')]) {
  assert.throws(() => parseBFGroup(input), /2–50/);
}
for (const input of ['1,,2', '1,2,', ',1,2']) assert.throws(() => parseBFGroup(input), /空字段/);
assert.deepEqual(parseBFGroup('-1，0;2'), [-1, 0, 2]);
assert.throws(() => brownForsythe([1, 2], [1, NaN]));
const subnormal = [[0, 5e-324, 1e-323, 3e-323], [0, 1e-323, 2e-323, 5e-323]];
assert.throws(() => brownForsythe(...subnormal), /浮点精度下限/);
assert.throws(() => brownForsytheRCode(...subnormal), /浮点精度下限/);
assert.throws(() => parseBFGroup('1e-300,1.1e-300,2e-300'), /组内差异/);
assert.throws(() => parseBFGroup('0,1e-301'), /计量单位/);
const offsetValues = [999999.900001, 999999.900002, 999999.900003];
assert.ok(bfAxis(offsetValues).note.includes(String(offsetValues[0])), 'Axis offset must retain the complete baseline');

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.classList = { add() {} }; this.value = ''; this.disabled = false; this.hidden = false; this._text = ''; this._html = ''; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(child) { this.children.push(child); }
  contains(target) { return this === target || this.children.some(child => child.contains(target)); }
  replaceChildren(...children) { if (this.contains(document.activeElement)) document.activeElement = null; this.children = children; }
  addEventListener(name, callback) { (this.events[name] ??= []).push(callback); }
  async dispatch(name) { if (name === 'click' && this.disabled) return; for (const callback of this.events[name] || []) await callback(); }
  focus() { document.activeElement = this; }
}
const previousDocument = globalThis.document, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let copied = '', copyFail = false, copyResolve = null;
globalThis.document = { activeElement: null, createElement: tag => new Element(tag), createElementNS: (namespace, tag) => new Element(tag) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (copyFail) throw Error('denied'); copied = text; if (copyResolve) await new Promise(resolve => { copyResolve = resolve; }); } } } });
try {
  for (const [a, b] of [...cases, [[0, 0], [0, 0]], [[1e-300, 1e-300], [0, 0]]]) {
    const result = brownForsythe(a, b);
    for (const kind of ['raw', 'z']) {
      const svg = new Element('svg'); drawBrownForsythe(svg, result, kind, 'B1');
      const points = svg.children.filter(el => 'data-bf-point' in el.attrs);
      assert.equal(points.length, a.length + b.length);
      points.forEach(point => {
        const left = point.tag === 'circle' ? +point.attrs.cx - +point.attrs.r : +point.attrs.x;
        const right = point.tag === 'circle' ? +point.attrs.cx + +point.attrs.r : +point.attrs.x + +point.attrs.width;
        assert.ok(left >= 76 && right <= 624, 'Full raw and Z markers fit the plot');
      });
      assert.ok(svg.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
      const ticks = svg.children.filter(el => el.attrs.class === 'bf-tick').map(el => el.textContent);
      assert.equal(new Set(ticks).size, 5);
      assert.ok(ticks.every(label => label.length <= 7 && Number.isFinite(Number(label))));
      assert.equal(svg.children.filter(el => 'data-bf-center' in el.attrs).length, 2);
    }
  }
  // Changing the positive measurement unit preserves normalized point geometry.
  const geometry = values => { const axis = bfAxis(values); return values.map(axis.position); };
  const values = [1, 2, 3, 4, 5], positions = geometry(values);
  for (const changed of [values.map(v => v * 1e-9), values.map(v => v + 999980)]) geometry(changed).forEach((value, i) => close(value, positions[i], 1e-9));

  const keys = ['error', 'operation', 'results', 'summary', 'trace', 'rows', 'anova', 'conclusion', 'copy', 'code', 'copy-status'];
  const elements = Object.fromEntries(keys.map(key => [`[data-bf-${key}]`, new Element(key === 'rows' ? 'tbody' : 'div')]));
  for (const key of ['a', 'b']) elements[`[data-bf-input="${key}"]`] = new Element('textarea');
  for (const key of ['shift', 'spread', 'reset']) elements[`[data-bf-action="${key}"]`] = new Element('button');
  for (const key of ['raw', 'z']) { elements[`[data-bf-plot="${key}"]`] = new Element('svg'); elements[`[data-bf-axis="${key}"]`] = new Element(); }
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-bf-${key}]`], input = key => elements[`[data-bf-input="${key}"]`], action = key => elements[`[data-bf-action="${key}"]`];
  input('a').value = '2, 3, 4'; input('b').value = '1, 3, 5'; mountBrownForsythe(root); mountBrownForsythe(root);
  assert.equal(input('a').events.input.length, 1); assert.equal(action('shift').events.click.length, 1);
  assert.match(get('anova').innerHTML, /0.42164826/);
  const tableButton = id => get('rows').children.map(row => row.children[0].children[0]).find(button => button.textContent === `追踪 ${id}`);
  const b1 = tableButton('B1'); b1.focus(); get('rows').scrollTop = 100;
  await b1.dispatch('click');
  assert.equal(document.activeElement, b1); assert.equal(tableButton('B1'), b1); assert.equal(get('rows').scrollTop, 100);
  assert.match(get('trace').textContent, /B1.*Y=1.*median=3.*Z=2/);
  const anova = get('anova').innerHTML;
  await action('shift').dispatch('click');
  assert.equal(input('b').value, '101, 103, 105'); assert.equal(get('anova').innerHTML, anova);
  assert.equal(tableButton('B1'), b1); assert.equal(document.activeElement, b1);
  await action('reset').dispatch('click'); await action('spread').dispatch('click');
  assert.equal(input('b').value, '-1, 3, 7'); assert.match(get('trace').textContent, /A1/);
  await b1.dispatch('click'); assert.match(get('trace').textContent, /B1.*Y=-1.*Z=4/);
  await get('copy').dispatch('click'); assert.equal(copied, get('code').textContent); assert.match(get('copy-status').textContent, /已复制/);
  copyFail = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中/); copyFail = false;
  copyResolve = true; const pending = get('copy').dispatch('click'); await action('reset').dispatch('click'); copyResolve(); copyResolve = null; await pending;
  assert.equal(get('copy-status').textContent, '');
  input('a').value = '1, 3'; input('b').value = '2, 8'; await input('b').dispatch('input');
  assert.equal(get('results').hidden, false); assert.match(get('conclusion').textContent, /MSE/); assert.match(get('anova').innerHTML, /未定义/);
  input('a').value = '.1,.1,.1'; input('b').value = '.2,.2,.2'; await input('a').dispatch('input');
  assert.match(get('conclusion').textContent, /所有 Z 都为 0/); assert.equal(get('copy').disabled, false);
  input('a').value = '2,3,4'; input('b').value = '1e-20,2e-20,3e-20'; await input('b').dispatch('input');
  const beforeReject = { input: input('b').value, anova: get('anova').innerHTML, raw: JSON.stringify(elements['[data-bf-plot="raw"]'].children), code: get('code').textContent };
  await action('shift').dispatch('click');
  assert.match(get('error').textContent, /浮点精度.*未改变/);
  assert.deepEqual({ input: input('b').value, anova: get('anova').innerHTML, raw: JSON.stringify(elements['[data-bf-plot="raw"]'].children), code: get('code').textContent }, beforeReject);
  for (const invalid of ['a,b', '1,,2', Array(51).fill(1).join(','), subnormal[1].join(',')]) {
    input('b').value = invalid; await input('b').dispatch('input');
    assert.equal(get('results').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, '');
    assert.equal(elements['[data-bf-plot="raw"]'].children.length, 0); assert.equal(elements['[data-bf-plot="z"]'].children.length, 0);
    assert.ok(!get('error').textContent.includes('2–500'));
    await action('reset').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(tableButton('B1'), b1);
  }
  const aInput = input('a'); aInput.focus(); aInput.value = '2,3,4,5'; await aInput.dispatch('input');
  assert.equal(document.activeElement, aInput); assert.equal(tableButton('B1'), b1); assert.equal(get('rows').children.length, 7);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log('Brown–Forsythe: independent R analyses and executable current-data code, degeneracy/scales, transformations, finite SVG geometry, stable table focus, invalid recovery and copy lifecycle passed.');
