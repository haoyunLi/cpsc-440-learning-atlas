import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as M from '../assets/math.mjs';

// Evaluate the production mount functions in an isolated SVG/DOM fixture.
// No browser, user storage, or absolute source paths are required.
const source = fs.readFileSync(new URL('../assets/atlas.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.attrs = {}; this.events = {}; this.textContent = ''; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  addEventListener(name, callback) { this.events[name] = callback; }
}
const context = vm.createContext({ M, document: {
  querySelectorAll: () => [], querySelector: () => null,
  createElementNS: (namespace, tag) => new Element(tag)
} });
vm.runInContext(`${source}\nglobalThis.testMounts={axes,labVariance,labMultiple};`, context);
function mount(kind, settings) {
  const fields = Object.fromEntries(Object.entries(settings).map(([id, value]) => [id, Object.assign(new Element(id === 'band' ? 'select' : 'input'), { id, value: String(value) })]));
  const graph = new Element('svg'), readout = new Element();
  const outputs = Object.fromEntries(Object.keys(fields).map(id => [`${id}-v`, new Element()]));
  const host = {
    querySelector: selector => selector === 'svg' ? graph : selector === '.readout' ? readout : fields[selector.slice(1)] || outputs[selector.slice(1)],
    querySelectorAll: selector => Object.values(fields).filter(el => selector !== 'input[type=range]' || el.tag === 'input')
  };
  context.testMounts[kind](host);
  return { graph, readout, change(patch) {
    for (const [key, value] of Object.entries(patch)) fields[key].value = String(value);
    Object.values(fields)[0].events.input();
  } };
}
const yTicks = graph => graph.children.filter(el => el.tag === 'text' && el.attrs['text-anchor'] === 'end');
const labels = graph => yTicks(graph).map(el => el.textContent);
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);

const variance = mount('labVariance', { vn: 10, vs: 4 });
for (let n = 4; n <= 100; n++) {
  variance.change({ vn: n });
  const ticks = yTicks(variance.graph), values = ticks.map(el => Number(el.textContent));
  assert.equal(ticks.length, 5);
  assert.equal(new Set(values).size, 5, `n=${n} has duplicate density ticks`);
  assert.ok(ticks.every(el => el.textContent.length <= 6));
  assert.ok(values.every((value, i) => Number.isFinite(value) && (!i || value > values[i - 1])));
  // The labels should describe the numerical density at each existing tick,
  // with error small relative to the tick interval, not merely be distinct.
  const max = M.chiPDF(n - 3, n - 1) * 1.2, step = max / 4;
  values.forEach((value, i) => {
    near(value, step * i, step * .05);
    near(Number(ticks[i].attrs.y), 270 - 55 * i);
  });
  assert.ok(variance.graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
}
// n=97..100 previously rounded both top ticks to 0.03. The labels below also
// agree with R dchisq(97,df=99)*1.2 = 0.034311858878888 for n=100.
variance.change({ vn: 100 });
assert.deepEqual(labels(variance.graph), ['0', '0.0086', '0.0172', '0.0257', '0.0343']);
// Independent R: 99*4/qchisq(c(.975,.025),99).
assert.match(variance.readout.textContent, /95% σ² CI=\[3.084,5.398\]/);
variance.change({ vn: 10, vs: 4 });
assert.match(variance.readout.textContent, /95% σ² CI=\[1.892,13.331\]/);
const referencePlot = JSON.stringify(variance.graph.children);
variance.change({ vs: 8 });
assert.equal(JSON.stringify(variance.graph.children), referencePlot, 'Observed variance changes the inverted interval, not the reference density');
assert.match(variance.readout.textContent, /95% σ² CI=\[3.785,26.663\]/);

// Omitting the new formatter must preserve all pre-existing default formats,
// tick positions, and custom horizontal formatting used by other labs.
for (const [low, high] of [[0, .5], [0, 1], [-15, 48]]) {
  const graph = new Element('svg');
  const map = context.testMounts.axes(graph, 'x', 'y', 0, 9, low, high);
  assert.deepEqual(labels(graph), Array.from({ length: 5 }, (_, i) => (low + (high - low) * i / 4).toFixed(high - low < 1 ? 2 : 1)));
  near(map.x(0), 85); near(map.x(9), 635);
  near(map.y(low), 265); near(map.y(high), 45);
}
const customX = new Element('svg');
context.testMounts.axes(customX, 'x', 'y', 0, 1, 0, 1, value => `x:${value}`);
assert.deepEqual(customX.children.filter(el => el.tag === 'text' && el.attrs.class === 'plot-muted' && el.attrs['text-anchor'] === 'middle').map(el => el.textContent), ['x:0', 'x:0.25', 'x:0.5', 'x:0.75', 'x:1']);
assert.deepEqual(labels(customX), ['0.0', '0.3', '0.5', '0.8', '1.0']);

// The regression lab now has independent numerical, geometry and UI tests
// in regression.mjs; shared axes are still verified above.
const multiple = mount('labMultiple', { mm: 20, ma: .05 });
assert.deepEqual(labels(multiple.graph), ['0.0', '0.3', '0.5', '0.8', '1.0']);
assert.match(multiple.readout.textContent, /corrected FWER=0.0488/);
console.log('Variance density ticks: all n=4..100 distinct and accurate; CI/reference geometry, default axes, custom horizontal ticks and multiplicity mount preserved.');
