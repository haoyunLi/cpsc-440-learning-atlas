import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { influenceAnalysis, influenceGeometry, influenceRCode, parseInfluenceValue, drawInfluence, mountInfluence } from '../assets/influence.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} versus ${b}`);
const settings = [{ x: 10, y: 22.6 }, { x: 10, y: 5 }, { x: 2, y: 20 },
  { x: -4, y: -10 }, { x: -4, y: 40 }, { x: 14, y: -10 }, { x: 14, y: 40 },
  { x: 0, y: 1 }, { x: 2, y: 5 }, { x: 8, y: .6 }, { x: 3.1, y: 8.7 }, { x: -.1, y: 39.9 }];
const cases = settings.flatMap(setting => Array.from({ length: 6 }, (_, selected) => ({ ...setting, selected })));
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-influence-'));
try {
  const blocks = cases.map((setting, i) => `local({
d_ref <- data.frame(x=c(0,1,2,3,4,${setting.x}),y=c(1,2,5,8,9,${setting.y}))
full_ref <- lm(y~x,data=d_ref)
omit_ref <- lm(y~x,data=d_ref[-${setting.selected + 1},])
mse_ref <- deviance(full_ref)/df.residual(full_ref)
values_ref <- c(coef(full_ref),coef(omit_ref),mse_ref,
  as.vector(t(cbind(fitted(full_ref),residuals(full_ref),hatvalues(full_ref),
                   cooks.distance(full_ref),predict(omit_ref,newdata=d_ref)))))
cat("INFLREF",${i},paste(sprintf("%.17g",values_ref),collapse=","),sep="\t");cat("\n")
invisible(capture.output({
${influenceRCode(setting)}
}))
stopifnot(nrow(d)==6,abs(sum(h)-2)<1e-12,
          max(abs(coef(full)-coef(full_ref)))<1e-10,
          max(abs(sensitivity_predictions-predict(omit_ref,newdata=d_ref)))<1e-10)
})`).join('\n');
  const file = join(temp, 'reference.R'); writeFileSync(file, blocks);
  const output = execFileSync(process.env.RSCRIPT || 'Rscript', [file], { encoding: 'utf8', maxBuffer: 2e6 });
  const rows = output.split('\n').filter(line => line.startsWith('INFLREF\t')); assert.equal(rows.length, cases.length);
  rows.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(Number), result = influenceAnalysis(cases[i]);
    const actual = [result.full.intercept, result.full.slope, result.without.intercept, result.without.slope, result.full.mse,
      ...result.rows.flatMap(row => [row.fitted, row.residual, row.leverage, row.cook, row.sensitivityFitted])];
    assert.equal(actual.length, expected.length); actual.forEach((value, j) => close(value, expected[j]));
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

const on = influenceAnalysis(settings[0]), off = influenceAnalysis(settings[1]), ordinary = influenceAnalysis(settings[2]);
close(on.full.intercept, .6); close(on.full.slope, 2.2); assert.ok(on.rows[5].cook < 1e-20);
close(off.full.intercept, 3.842105263157895); close(off.full.slope, .3473684210526316); close(off.rows[5].leverage, .8684210526315789);
close(off.rows[5].residual, -2.3157894736842106); close(off.rows[5].cook, 12.70139165009939);
assert.equal(on.rows[5].leverage, off.rows[5].leverage);
assert.ok(Math.abs(ordinary.rows[5].residual) > Math.abs(off.rows[5].residual)); assert.ok(ordinary.rows[5].cook < off.rows[5].cook);
close(ordinary.rows[5].leverage, 1 / 6); close(ordinary.rows[5].cook, .3966155473294553);
assert.deepEqual(on.remainingRange, [0, 4]); assert.equal(on.selectedExtrapolation, true); assert.equal(off.selectedExtrapolation, true);
assert.equal(ordinary.selectedExtrapolation, false);
assert.equal(influenceAnalysis({ x: 10, y: 5, selected: 0 }).selectedExtrapolation, true);
assert.equal(influenceAnalysis({ x: -4, y: 5, selected: 0 }).selectedExtrapolation, false);
assert.equal(influenceAnalysis({ x: 4, y: 5, selected: 5 }).selectedExtrapolation, false);
for (const setting of cases) {
  const r = influenceAnalysis(setting); assert.equal(r.rows.length, 6); assert.equal(r.full.n, 6); assert.equal(r.without.n, 5);
  close(r.sumLeverage, 2); assert.ok(r.full.mse >= .4 - 1e-12);
  close(r.rows[setting.selected].cook, r.selectedCookFromPredictions);
  assert.ok(r.rows.every(row => row.leverage >= 1 / 6 && row.leverage < 1 && row.cook >= 0));
  const noSelectionChange = influenceAnalysis({ ...setting, selected: (setting.selected + 1) % 6 });
  assert.deepEqual(r.rows.map(({ sensitivityFitted, ...row }) => row), noSelectionChange.rows.map(({ sensitivityFitted, ...row }) => row));
}
for (const [kind, bad] of [['x', ''], ['y', ' '], ['x', '0x10'], ['x', '-4.1'], ['x', '14.1'], ['y', '-10.1'], ['y', '40.1'], ['y', '1.25'], ['x', 'NaN'], ['x', '1e-400']]) assert.throws(() => parseInfluenceValue(bad, kind));
for (const [kind, value] of [['x', -4], ['x', 14], ['y', -10], ['y', 40], ['x', .1], ['y', 22.6]]) assert.equal(parseInfluenceValue(String(value), kind), value);
assert.throws(() => influenceAnalysis({ x: 10, y: 5, selected: 6 }), /请选择/);
assert.throws(() => influenceAnalysis({ x: 10.01, y: 5 }), /0.1/);
for (const raw of ['1e-16', '-1e-16', '5e-324']) {
  assert.throws(() => parseInfluenceValue(raw, 'x'), /0.1/);
  assert.throws(() => influenceAnalysis({ x: Number(raw), y: 5 }), /0.1/);
}

// Cover every legal x step, representative response extremes and every
// selected point. The fixed viewport must show all six points and residuals;
// both clipped sensitivity/full line endpoints must lie on the same axes.
for (let xi = -40; xi <= 140; xi++) for (const y of [-10, 0, 5, 22.6, 40]) for (let selected = 0; selected < 6; selected++) {
  const r = influenceAnalysis({ x: xi / 10, y, selected }), g = influenceGeometry(r), f = g.frame;
  assert.deepEqual(g.domain, { x: [-5, 15], y: [-12, 42] });
  g.points.forEach(point => {
    assert.ok(point.x - 6 >= f.left && point.x + 6 <= f.right && point.y - 6 >= f.top && point.y + 6 <= f.bottom);
    assert.ok(point.fittedY >= f.top && point.fittedY <= f.bottom);
  });
  for (const line of [g.fullLine, g.sensitivityLine]) {
    assert.ok(line && Object.values(line).every(Number.isFinite));
    assert.ok(line.x1 >= f.left - 1e-10 && line.x2 <= f.right + 1e-10);
    for (const endpoint of [line.y1, line.y2]) assert.ok(endpoint >= f.top - 1e-10 && endpoint <= f.bottom + 1e-10);
  }
  close(r.rows[selected].cook, r.selectedCookFromPredictions);
}

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
  for (const setting of cases) {
    const result = influenceAnalysis(setting); drawInfluence(graph, result);
    assert.equal(graph.children.filter(el => 'data-infl-point' in el.attrs).length, 6);
    assert.equal(graph.children.filter(el => 'data-infl-residual' in el.attrs).length, 6);
    assert.equal(graph.children.filter(el => 'data-infl-line' in el.attrs).length, 2);
    assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    const ticks = graph.children.filter(el => el.attrs.class === 'infl-tick' && el.attrs['text-anchor'] === 'end').map(el => el.textContent);
    assert.equal(new Set(ticks).size, 6);
  }
  const elements = {};
  for (const kind of ['x', 'y']) for (const type of ['number', 'range']) elements[`[data-infl-${type}="${kind}"]`] = Object.assign(new Element('input'), { value: String(settings[0][kind]) });
  for (const key of ['error', 'results', 'coefficients', 'selected', 'checks', 'copy', 'code', 'copy-status']) elements[`[data-infl-${key}]`] = new Element();
  for (const kind of ['main', 'large']) elements[`[data-infl-plot="${kind}"]`] = new Element('svg');
  for (const name of ['online', 'offline', 'residual']) elements[`[data-infl-preset="${name}"]`] = new Element('button');
  for (let i = 0; i < 6; i++) {
    elements[`[data-infl-select="${i}"]`] = new Element('button'); elements[`[data-infl-row="${i}"]`] = new Element('tr');
    for (const key of ['x', 'y', 'fitted', 'residual', 'leverage', 'cook']) elements[`[data-infl-cell="${i}-${key}"]`] = new Element('td');
  }
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-infl-${key}]`], number = kind => elements[`[data-infl-number="${kind}"]`], range = kind => elements[`[data-infl-range="${kind}"]`], select = i => elements[`[data-infl-select="${i}"]`], preset = key => elements[`[data-infl-preset="${key}"]`];
  mountInfluence(root); mountInfluence(root);
  assert.equal(number('x').events.input.length, 1); assert.equal(select(5).events.click.length, 1);
  assert.match(get('coefficients').textContent, /0.6 \+ 2.2x/); assert.match(elements['[data-infl-cell="5-cook"]'].textContent, /e-/);
  assert.equal(preset('online').attrs['aria-pressed'], 'true'); assert.equal(preset('offline').attrs['aria-pressed'], 'false');
  assert.match(get('selected').textContent, /范围.*\[0,4\].*外推.*不能作为经验证/);
  const tableRow = elements['[data-infl-row="0"]'], stable = select(0); stable.focus(); await stable.dispatch('click');
  assert.equal(document.activeElement, stable); assert.equal(select(0), stable); assert.equal(elements['[data-infl-row="0"]'], tableRow);
  assert.equal(tableRow.attrs['data-selected'], 'true'); assert.match(get('selected').textContent, /选中 P1/);
  assert.match(get('code').textContent, /selected <- 1/);
  await preset('offline').dispatch('click'); assert.equal(number('x').value, '10'); assert.equal(number('y').value, '5'); assert.equal(select(5).attrs['aria-pressed'], 'true');
  assert.equal(preset('online').attrs['aria-pressed'], 'false'); assert.equal(preset('offline').attrs['aria-pressed'], 'true');
  assert.match(get('selected').textContent, /Cook D=12.70139/);
  const main = elements['[data-infl-plot="main"]'], large = elements['[data-infl-plot="large"]']; assert.equal(JSON.stringify(main.children), JSON.stringify(large.children));
  await get('copy').dispatch('click'); assert.equal(copied, influenceRCode({ x: 10, y: 5, selected: 5 })); assert.match(get('copy-status').textContent, /已复制/);
  failCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中/); failCopy = false;
  waitCopy = true; const pendingCopy = get('copy').dispatch('click'); await select(2).dispatch('click'); resolveCopy(); await pendingCopy; waitCopy = false; assert.equal(get('copy-status').textContent, '');
  number('x').focus(); number('x').value = '-4'; await number('x').dispatch('input'); assert.equal(range('x').value, '-4'); assert.equal(document.activeElement, number('x'));
  for (const key of ['online', 'offline', 'residual']) assert.equal(preset(key).attrs['aria-pressed'], 'false');
  range('y').value = '40'; await range('y').dispatch('input'); assert.equal(number('y').value, '40'); assert.equal(JSON.stringify(main.children), JSON.stringify(large.children));
  for (const invalid of ['', '14.1', 'NaN', '3.05', '1e-400']) {
    number('x').value = invalid; await number('x').dispatch('input');
    assert.equal(get('results').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, '');
    assert.equal(main.children.length, 0); assert.equal(large.children.length, 0); assert.equal(select(0).disabled, true);
    for (const key of ['online', 'offline', 'residual']) assert.equal(preset(key).attrs['aria-pressed'], 'false');
    assert.match(get('error').textContent, /尚无有效结果/);
    await preset('online').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(get('copy').disabled, false); assert.equal(select(0).disabled, false);
  }
  number('x').value = '2'; number('y').value = '20'; await number('y').dispatch('input');
  assert.equal(preset('residual').attrs['aria-pressed'], 'true'); assert.equal(preset('online').attrs['aria-pressed'], 'false'); assert.match(get('selected').textContent, /范围 \[0,4\] 内/);
  assert.match(root.innerHTML, /原数据没有删除/); assert.match(root.innerHTML, /不建立因果关系/); assert.match(root.innerHTML, /窄屏请在表内横向滚动/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log(`Influence: ${settings.length} data sets × all six selections independently matched to R; Cook's fitted-change identity, every x-step geometry, stable six-point controls, coupled inputs, invalid recovery and copy lifecycle passed.`);
