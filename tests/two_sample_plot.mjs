import assert from 'node:assert/strict';
import { twoSampleAxis, twoSample, mountWorkbench, tailProbability, distributionPlot } from '../assets/workbench.mjs';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const a = [1, 2, 4], b = [2, 4, 7], values = [...a, ...b];
const original = twoSampleAxis(values);
for (const [scale, offset, tolerance] of [[.001, 0, 1e-12], [1, 999990, 1e-12], [.001, 999990, 1e-7], [1e-12, 0, 1e-12]]) {
  const changed = values.map(value => value * scale + offset), axis = twoSampleAxis(changed);
  changed.forEach((value, i) => near(axis.position(value), original.position(values[i]), tolerance));
  assert.equal(new Set(axis.ticks.map(tick => tick.label)).size, 5);
  assert.ok(axis.ticks.every(tick => Number.isFinite(Number(tick.label)) && tick.label.length <= 6));
}
assert.equal(twoSampleAxis(values.map(v => v * .001)).exponent, -3);
assert.equal(twoSampleAxis(values.map(v => v + 999990)).offset, 999991);
for (const sample of [[0, 0], [.1, .1], [-1e6, -1e6], [1e-323, 2e-323], [-1e6, 1e6], [-.001, .05], [99, 99.001], [1e-12, 2e-12]]) {
  const axis = twoSampleAxis(sample);
  assert.equal(new Set(axis.ticks.map(tick => tick.label)).size, 5);
  assert.ok(axis.ticks.every(tick => Number.isFinite(Number(tick.label)) && tick.label.length <= 6));
  assert.ok(sample.every(value => Number.isFinite(axis.position(value)) && axis.position(value) > 0 && axis.position(value) < 1));
  if (sample[0] === sample[1]) { near(axis.position(sample[0]), .5); assert.match(axis.scaleNote, /所有观测相同/); }
}
for (const sample of [[], [1, NaN], [1, Infinity], [-1e308, 1e308]]) assert.throws(() => twoSampleAxis(sample));

// Exercise the real mount/update path with isolated DOM fixtures. This verifies
// generated SVG coordinates and state, not browser font metrics or CSS layout.
class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.textContent = ''; this.value = ''; this.disabled = false; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.events[name] = callback; }
}
function fixture(kind, fields, selectors) {
  const controls = Object.fromEntries(Object.entries(fields).map(([name, value]) => { const el = new Element(); el.value = String(value); return [name, el]; }));
  const elements = Object.fromEntries(selectors.map(selector => [selector, new Element(selector === 'svg' ? 'svg' : 'div')]));
  const root = {
    dataset: { workbench: kind }, classList: { add() {} },
    set innerHTML(value) {},
    querySelector(selector) { const match = selector.match(/^\[data-field="(.+)"\]$/); return match ? controls[match[1]] : elements[selector]; },
    querySelectorAll() { return Object.values(controls); }
  };
  mountWorkbench(root);
  return { root, controls, elements, update(name, value) { controls[name].value = String(value); controls[name].events.input(); } };
}
const previousDocument = globalThis.document;
globalThis.document = { createElementNS(namespace, tag) { return new Element(tag); } };
try {
  const sampleFixture = (left = a, right = b, method = 'welch') => fixture('two-sample', { a: left.join(', '), b: right.join(', '), method, confidence: .95 }, ['svg', '.wbench-result', '.wbench-error', '.wbench-assumptions', '.wbench-code', '[data-two-sample-scale]']);
  const circles = state => state.elements.svg.children.filter(el => el.tag === 'circle');
  const pairedLines = state => state.elements.svg.children.filter(el => el.tag === 'line' && el.attrs.stroke === '#adc5b9');
  const tickLabels = state => state.elements.svg.children.filter(el => el.tag === 'text' && el.attrs.class === 'wbench-tick' && el.attrs['text-anchor'] === 'end');
  const compareGeometry = (state, reference, tolerance = 1e-9) => {
    const current = [...circles(state), ...pairedLines(state)], expected = [...circles(reference), ...pairedLines(reference)];
    assert.equal(current.length, expected.length);
    current.forEach((node, i) => { for (const key of ['cx', 'cy', 'x1', 'x2', 'y1', 'y2']) if (key in node.attrs) near(Number(node.attrs[key]), Number(expected[i].attrs[key]), tolerance); });
    assert.equal(new Set(tickLabels(state).map(el => el.textContent)).size, 5);
    assert.ok(tickLabels(state).every(el => Number.isFinite(Number(el.textContent)) && el.textContent.length <= 6));
    assert.ok(circles(state).every(el => Number(el.attrs.cy) - Number(el.attrs.r) > 51 && Number(el.attrs.cy) + Number(el.attrs.r) < 258));
  };
  for (const method of ['welch', 'pooled', 'paired']) {
    const reference = sampleFixture(a, b, method);
    for (const [scale, offset, tolerance] of [[.001, 0, 1e-9], [1, 999990, 1e-9], [.001, 999990, 2e-5], [1e-12, 0, 1e-9]]) {
      const state = sampleFixture(a.map(v => v * scale + offset), b.map(v => v * scale + offset), method);
      assert.equal(state.elements['.wbench-error'].textContent, '');
      compareGeometry(state, reference, tolerance);
      assert.match(state.elements['[data-two-sample-scale]'].textContent, /纵轴实际响应 Y =/);
      assert.match(state.elements.svg.attrs['aria-label'], /原始输入单位/);
      assert.ok(state.elements['.wbench-code'].textContent.includes(a.map(v => v * scale + offset).join(', ')));
    }
    assert.equal(pairedLines(reference).length, method === 'paired' ? 3 : 0);
  }
  // Preserve the default example's point positions and the original inference.
  const defaultA = [8, 10, 13, 14, 18, 20], defaultB = [7, 8, 10, 12, 12, 13];
  const standard = sampleFixture(defaultA, defaultB), pad = 13 * .12;
  circles(standard).forEach((circle, i) => near(Number(circle.attrs.cy), 258 - ([...defaultA, ...defaultB][i] - (7 - pad)) / (13 + 2 * pad) * 207));
  near(twoSample(defaultA, defaultB).p, .1385258, 1e-7);
  const clearState = sampleFixture();
  for (const invalid of ['1,,2', '1, NaN', '1,']) {
    clearState.update('a', invalid);
    assert.equal(clearState.elements.svg.children.length, 0);
    assert.equal(clearState.elements['[data-two-sample-scale]'].textContent, '');
    assert.equal(clearState.elements['.wbench-code'].textContent, '');
    assert.match(clearState.elements.svg.attrs['aria-label'], /等待有效/);
    clearState.update('a', a.join(', '));
    assert.equal(circles(clearState).length, 6);
  }
  // One constant group can be valid; two constant groups and invalid pairing
  // must retain the inference error instead of showing a misleading old plot.
  clearState.update('a', '3,3,3');
  assert.equal(circles(clearState).length, 6);
  clearState.update('b', '4,4,4');
  assert.match(clearState.elements['.wbench-error'].textContent, /标准误为 0/);
  assert.equal(clearState.elements.svg.children.length, 0);
  clearState.update('b', b.join(', ')); clearState.update('method', 'paired'); clearState.update('b', '2,4');
  assert.match(clearState.elements['.wbench-error'].textContent, /长度相同/);
  assert.equal(clearState.elements.svg.children.length, 0);
  // frame's optional response formatter must not change distribution markers.
  const distributionState = fixture('distribution', { kind: 'normal', tail: 'right', df1: 10, df2: 20, observed: 2, alpha: .05 }, ['svg', '.wbench-result', '.wbench-error', '.wbench-window-note']);
  const plan = distributionPlot('normal'), critical = tailProbability('normal', 2, 'right').critical[0];
  const markers = distributionState.elements.svg.children.filter(el => el.attrs.class === 'wbench-critical' || el.attrs.class === 'wbench-observed');
  assert.equal(markers.length, 2);
  near(Number(markers[0].attrs.x1), 72 + (critical - plan.lo) / (plan.hi - plan.lo) * 518);
  near(Number(markers[1].attrs.x1), 72 + (2 - plan.lo) / (plan.hi - plan.lo) * 518);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
}
console.log('Two-sample axes preserve units/translation geometry, compact ticks, paired lines, default reference markers and invalid-input clearing.');
