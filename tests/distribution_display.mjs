import assert from 'node:assert/strict';
import { distributionPlot, distributionTick, distributionProbabilityDisplay, tailProbability, mountWorkbench, diagnosticData } from '../assets/workbench.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
// Independent R references: pnorm(x, lower.tail=FALSE, log.p=TRUE), and
// pchisq(10000, df, lower.tail=FALSE, log.p=TRUE). Finite log probabilities
// distinguish positive interior tails from support-boundary log(0) = -Inf.
const underflowCases = [
  ['normal', 39, 10, -765.083156564378],
  ['normal', 40, 10, -804.608442013754],
  ['chi', 10000, 1, -5004.83106151365],
  ['chi', 10000, 10, -4969.1084809047],
  ['chi', 10000, 100, -4727.21343122907]
];
for (const [kind, x, df, logP] of underflowCases) {
  assert.ok(Number.isFinite(logP) && logP < Math.log(Number.MIN_VALUE));
  for (const tail of ['right', 'two']) {
    const p = tailProbability(kind, x, tail, df).p;
    assert.equal(p, 0);
    const display = distributionProbabilityDisplay(kind, x, tail, p);
    assert.match(display.text, /^P > 0.*数值下溢/);
    assert.match(display.note, /数学上大于 0/);
    assert.doesNotMatch(display.text, /1e-|1 ×|P = 0/);
  }
}
// A small positive input can underflow inside an intermediate expression even
// when the mathematical tail itself is representable. Do not claim a generic
// numeric upper bound for every zero returned by the floating-point algorithm.
const tiny = tailProbability('chi', Number.MIN_VALUE, 'left', 1).p;
assert.equal(tiny, 0);
assert.match(distributionProbabilityDisplay('chi', Number.MIN_VALUE, 'left', tiny).text, /^P > 0/);

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.value = ''; this.disabled = false; this.dataset = {}; this.classList = { add() {} }; this._text = ''; this._html = ''; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.events[name] = callback; }
}
// Mount the real production function. The fixture captures SVG and event
// behavior without depending on a browser or shared user localStorage.
function distributionFixture(initial = {}) {
  const fields = Object.fromEntries(Object.entries({ kind: 'normal', tail: 'right', df1: 10, df2: 20, observed: 2, alpha: .05, ...initial }).map(([name, value]) => { const el = new Element(); el.value = String(value); return [name, el]; }));
  const elements = Object.fromEntries(['svg', '.wbench-result', '.wbench-error', '.wbench-window-note'].map(selector => [selector, new Element(selector === 'svg' ? 'svg' : 'div')]));
  const root = new Element(); root.dataset.workbench = 'distribution';
  root.querySelector = selector => { const match = selector.match(/^\[data-field="(.+)"\]$/); return match ? fields[match[1]] : elements[selector]; };
  root.querySelectorAll = () => Object.values(fields);
  mountWorkbench(root);
  return { root, fields, elements, update(patch) { for (const [name, value] of Object.entries(patch)) fields[name].value = String(value); fields.kind.events.input(); } };
}
const saved = Object.fromEntries(['document', 'window', 'setInterval', 'clearInterval'].map(key => [key, globalThis[key]]));
const documentEvents = {}, windowEvents = {}, timers = new Map(); let timerId = 0;
const motion = { matches: false, addEventListener(name, callback) { this[name] = callback; } };
globalThis.document = { hidden: false, createElementNS(namespace, tag) { return new Element(tag); }, addEventListener(name, callback) { documentEvents[name] = callback; } };
globalThis.window = { matchMedia() { return motion; }, addEventListener(name, callback) { windowEvents[name] = callback; } };
globalThis.setInterval = callback => { const id = ++timerId; timers.set(id, callback); return id; };
globalThis.clearInterval = id => timers.delete(id);
const tick = () => [...timers.values()].forEach(callback => callback());
try {
  const state = distributionFixture();
  const svg = state.elements.svg;
  const result = () => state.elements['.wbench-result'].innerHTML;
  const yTicks = () => svg.children.filter(el => el.tag === 'text' && el.attrs['text-anchor'] === 'end').map(el => el.textContent);
  const dfs = [1, 1.01, 1.5, 1.99, 2, 2.01, 3, 10, 50, 75, 80, 90, 100];
  const settings = [['normal', 10, 20], ...['t', 'chi'].flatMap(kind => dfs.map(df => [kind, df, 20])), ...dfs.flatMap(df1 => [1, 1.5, 2, 10, 50, 100].map(df2 => ['f', df1, df2]))];
  for (const [kind, df1, df2] of settings) {
    const plan = distributionPlot(kind, df1, df2);
    const expected = Array.from({ length: 5 }, (_, i) => distributionTick(i * plan.yMax / 4, plan.yMax / 4));
    assert.equal(new Set(expected).size, 5, `${kind}(${df1},${df2}) has repeated ticks`);
    assert.ok(expected.every(label => Number.isFinite(Number(label)) && label.length <= 6));
    const step = plan.yMax / 4;
    expected.forEach((label, i) => near(Number(label), i * step, step * .05));
    for (const tail of ['left', 'right', 'two']) for (const alpha of [.01, .05, .1]) {
      state.update({ kind, df1, df2, tail, alpha, observed: 2 });
      assert.equal(state.elements['.wbench-error'].textContent, '');
      assert.deepEqual(yTicks(), expected);
      assert.doesNotMatch(svg.children.map(el => Object.values(el.attrs).join(' ')).join(' '), /NaN|Infinity/);
    }
  }
  state.update({ kind: 'chi', df1: 100, observed: 100 });
  assert.deepEqual(yTicks(), ['0', '0.0081', '0.0162', '0.0243', '0.0324']);
  for (const [kind, observed, df1] of underflowCases) {
    state.update({ kind, observed, df1, tail: 'right' });
    assert.match(result(), /<strong>P > 0.*数值下溢/);
    assert.match(result(), /观测值在当前绘图区之外/);
    assert.equal(svg.children.filter(el => el.attrs.class === 'wbench-observed').length, 0);
    assert.equal(svg.children.filter(el => el.tag === 'rect').length, 0);
  }
  for (const kind of ['chi', 'f']) {
    for (const tail of ['left', 'two']) {
      state.update({ kind, tail, observed: 0, df1: 1, df2: 3 });
      assert.match(result(), /<strong>P = 0<\/strong>/);
      assert.match(result(), /支持集边界/);
      assert.doesNotMatch(result(), /数值下溢/);
      assert.equal(svg.children.filter(el => el.tag === 'rect').length, 0);
    }
    state.update({ tail: 'right' });
    assert.match(result(), /<strong>P = 1<\/strong>/);
    assert.equal(svg.children.filter(el => el.tag === 'rect').length, 600);
  }
  for (const kind of ['normal', 't']) {
    state.update({ kind, observed: 0, tail: 'two' });
    assert.match(result(), /<strong>P = 1<\/strong>/);
  }
  // R pnorm(5)=0.99999971334842808 rounds to 1 at six decimals; pnorm(39)
  // itself rounds to 1 in double precision. Neither warrants an exact-one claim.
  for (const observed of [5, 8, 39, 40]) {
    state.update({ kind: 'normal', observed, tail: 'left' });
    assert.match(result(), /<strong>P ≈ 1.000000<\/strong>/);
    assert.match(result(), /舍入到 1/);
  }
  state.update({ kind: 'normal', observed: 2, tail: 'right' });
  assert.match(result(), /<strong>P = 0.022750<\/strong>/);
  assert.doesNotMatch(result(), /舍入到 1|数值下溢/);
  state.update({ observed: 10 });
  assert.match(result(), /<strong>P = 7.620e-24<\/strong>/);
  state.update({ kind: 'chi', df1: 10, observed: 12 });
  assert.match(result(), /<strong>P = 0.285057<\/strong>/);
  for (const patch of [{ kind: 't', df1: '' }, { kind: 'chi', df1: 10, observed: -1 }, { kind: 'f', df2: '' }]) {
    state.update(patch);
    assert.notEqual(state.elements['.wbench-error'].textContent, '');
    assert.equal(svg.children.length, 0);
    assert.equal(state.elements['.wbench-result'].textContent, '等待有效设置。');
    assert.equal(state.elements['.wbench-window-note'].textContent, '');
    state.update({ kind: 'normal', df1: 10, df2: 20, observed: 2 });
    assert.ok(svg.children.length > 0);
  }
  state.update({ kind: 'f', df1: 1, df2: 1, observed: 200, tail: 'right', alpha: .05 });
  assert.match(result(), /临界值：161.4476/);
  assert.match(state.elements['.wbench-window-note'].textContent, /部分临界值在图外/);
  assert.match(state.elements['.wbench-window-note'].textContent, /密度在 0 附近趋于无穷/);
  state.update({ kind: 't', df1: 1, observed: 20, tail: 'two' });
  assert.match(result(), /临界值：-12.7062 与 12.7062/);
  assert.equal(svg.children.filter(el => el.attrs.class === 'wbench-critical' || el.attrs.class === 'wbench-observed').length, 0);

  // The distribution-only formatter must leave diagnostic geometry and its
  // observed-order / sorted-order animation unchanged in all four modes.
  const mode = new Element(); mode.value = 'normal';
  const svgs = [new Element('svg'), new Element('svg')];
  const actions = Object.fromEntries(['step', 'play', 'all'].map(name => [name, new Element('button')]));
  const labels = { '.wbench-progress': new Element(), '.wbench-result': new Element() };
  const root = new Element(); root.dataset.workbench = 'diagnostics';
  root.querySelector = selector => selector === '[data-field="mode"]' ? mode : selector.startsWith('[data-action=') ? actions[selector.match(/"(.+)"/)[1]] : labels[selector];
  root.querySelectorAll = selector => selector === 'svg' ? svgs : [];
  mountWorkbench(root);
  const points = graph => graph.children.filter(el => el.tag === 'circle');
  for (const value of ['normal', 'skew', 'outlier', 'unequal']) {
    mode.value = value; mode.events.input();
    for (const graph of svgs) {
      assert.equal(points(graph).length, 48);
      for (const point of points(graph)) {
        const x = +point.attrs.cx, y = +point.attrs.cy, radius = +point.attrs.r;
        assert.ok(x - radius >= 72 && x + radius <= 590 && y - radius >= 51 && y + radius <= 258);
      }
    }
    actions.step.onclick();
    const data = diagnosticData(value), ymin = Math.min(...data.sorted) - .5, ymax = Math.max(...data.sorted) + .5;
    assert.equal(points(svgs[0]).length, 1); assert.equal(points(svgs[1]).length, 1);
    near(+points(svgs[0])[0].attrs.cy, 258 - (data.points[0].residual - ymin) / (ymax - ymin) * 207);
    near(+points(svgs[1])[0].attrs.cy, 258 - (data.sorted[0] - ymin) / (ymax - ymin) * 207);
    actions.play.onclick(); for (let i = 0; i < 47; i++) tick();
    assert.equal(timers.size, 0); assert.equal(points(svgs[0]).length, 48);
  }
  actions.play.onclick(); motion.matches = true; motion.change();
  assert.equal(timers.size, 0); assert.equal(actions.play.disabled, true);
  motion.matches = false; motion.change(); actions.play.onclick();
  document.hidden = true; documentEvents.visibilitychange(); assert.equal(timers.size, 0);
  document.hidden = false; actions.play.onclick(); windowEvents.pagehide(); assert.equal(timers.size, 0);
  console.log(`Distribution display: ${settings.length * 9} mounted legal states, distinct density ticks, underflow/boundary/near-one semantics, ordinary tails, invalid clearing and diagnostic animation regression passed.`);
} finally {
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}
