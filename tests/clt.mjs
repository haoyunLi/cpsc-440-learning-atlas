import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as M from '../assets/math.mjs';
import { CLT_LIMIT, createCLTSimulation, cltHistogram, cltRCode, drawCLTSample, drawCLTHistogram, mountCLT } from '../assets/clt.mjs';

const near = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
// Independently calculate the documented LCG using integer BigInt arithmetic,
// then use inverse exponential CDF draws. R's set.seed uses a different RNG.
function reference(n, B) {
  let seed = 440n, latest = [], latestSum = 0;
  const means = [];
  for (let b = 0; b < B; b++) {
    latest = []; latestSum = 0;
    for (let i = 0; i < n; i++) {
      seed = (1664525n * seed + 1013904223n) % (2n ** 32n);
      const value = -Math.log((Number(seed) + .5) / 4294967296);
      latest.push(value); latestSum += value;
    }
    means.push(latestSum / n);
  }
  const mean = means.reduce((sum, value) => sum + value, 0) / B;
  return { latest, latestSum, means, mean, sd: B > 1 ? Math.sqrt(means.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (B - 1)) : null };
}
for (let n = 1; n <= 100; n++) {
  const simulation = createCLTSimulation(n), empty = simulation.snapshot();
  assert.equal(empty.B, 0); assert.equal(empty.sdOfMeans, null); assert.equal(empty.latest, null);
  const state = simulation.draw(), expected = reference(n, 1);
  assert.equal(state.B, 1); assert.equal(state.total, n); assert.equal(state.added, 1);
  assert.equal(state.sdOfMeans, null);
  assert.deepEqual(state.latest.values, expected.latest);
  assert.equal(state.latest.sum, expected.latestSum); assert.equal(state.latest.mean, expected.means[0]);
  assert.deepEqual(state.means, [state.latest.mean]);
  assert.equal(state.theoreticalSE, 1 / Math.sqrt(n));
}
for (const n of [1, 2, 3, 10, 25, 100]) {
  const batch = createCLTSimulation(n), single = createCLTSimulation(n);
  batch.draw(100); for (let i = 0; i < 100; i++) single.draw();
  assert.deepEqual(batch.snapshot(), single.snapshot(), `n=${n}: single and batch sequences`);
  const expected = reference(n, 100), state = batch.snapshot();
  assert.deepEqual(state.means, expected.means); assert.deepEqual(state.latest.values, expected.latest);
  near(state.meanOfMeans, expected.mean); near(state.sdOfMeans, expected.sd);
  batch.reset(); batch.draw(1); batch.draw(100); batch.draw(99);
  single.reset(); single.draw(200);
  assert.deepEqual(batch.snapshot(), single.snapshot(), 'Mixed request sizes must not skip RNG values');
  batch.reset(n); batch.draw(CLT_LIMIT - 1);
  assert.equal(batch.draw(100).added, 1);
  const capped = batch.snapshot();
  assert.equal(capped.B, CLT_LIMIT); assert.equal(capped.total, n * CLT_LIMIT);
  assert.deepEqual(capped.latest.values, reference(n, CLT_LIMIT).latest);
  assert.equal(batch.draw().added, 0); assert.deepEqual(batch.snapshot(), capped);
  batch.reset(); assert.equal(batch.snapshot().B, 0);
  assert.deepEqual(batch.draw().latest.values, reference(n, 1).latest);
}
for (const n of [0, 101, 1.5, NaN, Infinity, '10']) assert.throws(() => createCLTSimulation(n));
const guarded = createCLTSimulation(); guarded.draw(); const original = guarded.snapshot();
for (const count of [0, -1, 1.5, 3001, NaN, Infinity]) { assert.throws(() => guarded.draw(count)); assert.deepEqual(guarded.snapshot(), original); }
assert.throws(() => guarded.reset(0)); assert.deepEqual(guarded.snapshot(), original);
const copy = guarded.snapshot(); copy.means[0] = -1; copy.latest.values[0] = -1;
assert.deepEqual(guarded.snapshot(), original, 'Snapshots cannot mutate simulation state');
for (const values of [[1, 2, 2], [10], [], reference(25, 100).means]) {
  const plan = cltHistogram(values);
  assert.equal(plan.counts.length, 24); assert.equal(plan.counts.reduce((sum, count) => sum + count, 0), values.length);
  assert.ok(plan.counts.every(count => Number.isInteger(count) && count >= 0));
  assert.ok(plan.maximumCount >= Math.max(...plan.counts));
}
assert.equal(cltHistogram([10]).counts[23], 1, 'The high endpoint belongs to the last bin');
for (const values of [[-1], [0], [NaN], [Infinity]]) assert.throws(() => cltHistogram(values));
assert.throws(() => cltRCode([]));

// Execute the actual copyable R code with both n=1 and n=100, checking that it
// uses the displayed observations and does not regenerate another sample.
for (const n of [1, 10, 100]) {
  const values = reference(n, 1).latest, code = cltRCode(values);
  const script = `printed <- capture.output({\n${code}\n})\nstopifnot(${n === 1 ? '!' : ''}any(grepl("within_sample_SD",printed)))\ncat(sprintf("%.17g\\n",c(length(y),sum(y),mean(y),1/sqrt(length(y)))))`;
  const result = execFileSync(process.env.RSCRIPT || 'Rscript', ['-e', script], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  const expected = reference(n, 1);
  assert.equal(result[0], n); near(result[1], expected.latestSum); near(result[2], expected.means[0]); near(result[3], 1 / Math.sqrt(n));
}

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.classList = { add() {} }; this.value = ''; this.disabled = false; this.hidden = false; this._text = ''; this._html = ''; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  addEventListener(type, callback) { (this.events[type] ??= []).push(callback); }
  async dispatch(type) { if (type === 'click' && this.disabled) return; for (const callback of this.events[type] || []) await callback(); }
}
const saved = Object.fromEntries(['document', 'navigator', 'setInterval', 'setTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let copied = '', clipboardError = false, clipboardFinish = null;
Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElementNS: (namespace, tag) => new Element(tag) } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async code => { if (clipboardError) throw Error('denied'); copied = code; if (clipboardFinish) await new Promise(resolve => { clipboardFinish = resolve; }); } } } });
globalThis.setInterval = globalThis.setTimeout = () => { throw Error('CLT must remain manual and have no playback timer'); };
try {
  const raw = new Element('svg'), histogram = new Element('svg');
  for (const n of [1, 2, 10, 25, 100]) for (const B of [1, 100, 3000]) {
    const simulation = createCLTSimulation(n), state = simulation.draw(B);
    drawCLTSample(raw, state.latest.values, state.latest.mean);
    drawCLTHistogram(histogram, state.means, state.latest.mean);
    const points = raw.children.filter(el => el.tag === 'circle');
    assert.equal(points.length, n);
    points.forEach((point, i) => {
      const x = +point.attrs.cx, y = +point.attrs.cy, radius = +point.attrs.r;
      assert.ok(x - radius >= 70 && x + radius <= 634 && y - radius >= 35 && y + radius <= 205);
      assert.equal(point.attrs['data-clt-observation'], String(i + 1));
      assert.match(point.children[0].textContent, new RegExp(`^Y${i + 1} = `));
    });
    const bars = histogram.children.filter(el => el.tag === 'rect'), plan = cltHistogram(state.means);
    assert.deepEqual(bars.map(bar => +bar.attrs['data-clt-count']), plan.counts);
    bars.forEach(bar => {
      const x = +bar.attrs.x, width = +bar.attrs.width, y = +bar.attrs.y, height = +bar.attrs.height;
      assert.ok(x >= 70 && x + width <= 634 && width > 0 && y >= 45 && y + height <= 255);
    });
    for (const [graph, high] of [[raw, Math.max(2, ...state.latest.values)], [histogram, plan.high]]) {
      const marker = graph.children.find(el => el.attrs['data-clt-mark'] === 'latest-mean');
      near(+marker.attrs.x1, 70 + (state.latest.mean / high + .04) / 1.08 * 564);
      assert.ok(+marker.attrs.x1 - 6 >= 70 && +marker.attrs.x1 + 6 <= 634);
      assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    }
  }
  drawCLTSample(raw, []); drawCLTHistogram(histogram, []);
  assert.equal(raw.children.length, 0); assert.equal(histogram.children.length, 0);

  const selectors = ['n', 'n-value', 'error', 'status', 'current-figure', 'means-figure', 'raw', 'means', 'current', 'calculation', 'values', 'values-details', 'statistics', 'code', 'copy', 'copy-status'];
  const elements = Object.fromEntries(selectors.map(name => [`[data-clt-${name}]`, new Element(name === 'raw' || name === 'means' ? 'svg' : 'div')]));
  for (const action of ['one', 'hundred', 'reset']) elements[`[data-clt-action="${action}"]`] = new Element('button');
  const root = new Element(); root.querySelector = selector => elements[selector];
  const el = name => elements[`[data-clt-${name}]`], action = name => elements[`[data-clt-action="${name}"]`];
  el('n').value = '10'; mountCLT(root);
  const one = action('one'), hundred = action('hundred'), details = el('values-details'); details.open = true;
  const markup = root.innerHTML; mountCLT(root);
  assert.equal(root.innerHTML, markup); assert.equal(one.events.click.length, 1);
  assert.match(el('status').textContent, /n=10.*B=0.*nB=0/); assert.equal(el('copy').disabled, true);
  await one.dispatch('click');
  assert.match(el('status').textContent, /n=10.*B=1.*nB=10/);
  assert.match(el('statistics').textContent, /未定义（B=1/);
  assert.equal((el('values').innerHTML.match(/<li>/g) || []).length, 10);
  assert.equal(el('raw').children.filter(node => node.tag === 'circle').length, 10);
  assert.equal(el('means').children.filter(node => node.tag === 'rect').reduce((sum, node) => sum + +node.attrs['data-clt-count'], 0), 1);
  const first = el('code').textContent;
  await hundred.dispatch('click'); assert.match(el('status').textContent, /B=101.*nB=1010/);
  assert.doesNotMatch(el('statistics').textContent, /未定义/); assert.equal(details.open, true);
  await el('copy').dispatch('click'); assert.equal(copied, el('code').textContent); assert.match(el('copy-status').textContent, /已复制/);
  clipboardError = true; await el('copy').dispatch('click'); assert.match(el('copy-status').textContent, /选中/); clipboardError = false;
  clipboardFinish = true; const pending = el('copy').dispatch('click');
  await action('reset').dispatch('click'); clipboardFinish(); clipboardFinish = null; await pending;
  assert.equal(el('copy-status').textContent, '', 'A delayed copy must not claim to copy the newly reset sample');
  assert.equal(el('raw').children.length, 0); assert.equal(el('means').children.length, 0);
  assert.equal(el('copy').disabled, true); assert.equal(el('values').innerHTML, '');
  await one.dispatch('click'); assert.equal(el('code').textContent, first);
  for (let i = 0; i < 29; i++) await hundred.dispatch('click');
  assert.match(el('status').textContent, /B=2901/); assert.equal(hundred.textContent, '重复剩余 99 组');
  await hundred.dispatch('click');
  assert.match(el('status').textContent, /B=3000.*nB=30000.*本次增加 99 组/);
  assert.equal(one.disabled, true); assert.equal(hundred.disabled, true);
  const capped = el('status').textContent; await one.dispatch('click'); assert.equal(el('status').textContent, capped);
  el('n').value = '1'; await el('n').dispatch('input');
  assert.match(el('status').textContent, /n=1.*B=0/); assert.equal(one.disabled, false); assert.equal(hundred.textContent, '重复 100 组');
  await one.dispatch('click'); assert.match(el('statistics').textContent, /未定义（B=1/);
  assert.equal(el('raw').children.filter(node => node.tag === 'circle').length, 1);
  for (const invalid of ['', '0', '101', '1.5', 'NaN']) {
    el('n').value = invalid; await el('n').dispatch('input');
    assert.match(el('error').textContent, /1–100/); assert.equal(one.disabled, true); assert.equal(el('copy').disabled, true);
    assert.equal(el('raw').children.length, 0); assert.equal(el('means').children.length, 0); assert.equal(el('code').textContent, '');
    el('n').value = '10'; await el('n').dispatch('input'); await one.dispatch('click'); assert.equal(el('code').textContent, first);
  }
  assert.equal(action('one'), one); assert.equal(action('hundred'), hundred); assert.equal(details.open, true);

  // Mount both real modules. Parent queries must include subsequently mounted
  // descendants, as the browser does. CLT deliberately has no #cltn-v output.
  const source = readFileSync(new URL('../assets/atlas.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const binomialFields = Object.fromEntries(Object.entries({ bn: 20, bp: .85, bk: 18 }).map(([id, value]) => [id, Object.assign(new Element('input'), { id, value: String(value) })]));
  const binomialSvg = new Element('svg'), binomialReadout = new Element(), cltRoot = new Element();
  const binomialOutputs = Object.fromEntries(Object.keys(binomialFields).map(id => [`${id}-v`, new Element()]));
  const nested = Object.fromEntries(selectors.map(name => [`[data-clt-${name}]`, new Element(name === 'raw' || name === 'means' ? 'svg' : 'div')]));
  for (const action of ['one', 'hundred', 'reset']) nested[`[data-clt-action="${action}"]`] = new Element('button');
  const nestedN = nested['[data-clt-n]']; nestedN.id = 'cltn'; nestedN.value = '10';
  cltRoot.querySelector = selector => nested[selector] || null;
  const host = {
    querySelector: selector => selector === 'svg' ? binomialSvg : selector === '.readout' ? binomialReadout : selector === '[data-clt]' ? cltRoot : selector === '#cltn' && cltRoot.dataset.cltReady ? nestedN : binomialFields[selector.slice(1)] || binomialOutputs[selector.slice(1)] || null,
    querySelectorAll: selector => ['input[type=range]', 'input,select,textarea'].includes(selector) ? [...Object.values(binomialFields), ...(cltRoot.dataset.cltReady ? [nestedN] : [])] : []
  };
  let mounts = 0;
  const context = vm.createContext({ M, document: { querySelector: () => null, querySelectorAll: () => [], createElementNS: (namespace, tag) => new Element(tag) }, mountCLT: root => { assert.equal(root, cltRoot); mounts++; mountCLT(root); } });
  vm.runInContext(`${source}\nglobalThis.mountProbability=labProbability;`, context);
  context.mountProbability(host); assert.equal(mounts, 1);
  assert.equal(host.querySelectorAll('input[type=range]').length, 4);
  assert.equal(host.querySelector('#cltn-v'), null, 'Do not invent an output that is absent in the mounted DOM');
  assert.equal(nestedN.events.input.length, 1, 'Only the CLT module handles its sample-size input');
  assert.equal(binomialSvg.children.filter(node => node.tag === 'rect').length, 21);
  assert.match(binomialReadout.textContent, /P\(Y≥18\)=0.404896/);
  const cltState = () => JSON.stringify(Object.entries(nested).map(([selector, element]) => [selector, element.value, element.textContent, element.innerHTML, element.disabled, element.children]));
  const binomialState = () => JSON.stringify([binomialReadout.textContent, binomialSvg.children, Object.values(binomialOutputs).map(element => element.textContent)]);
  const untouchedBinomial = binomialState();
  await nested['[data-clt-action="one"]'].dispatch('click');
  assert.match(nested['[data-clt-status]'].textContent, /n=10.*B=1.*nB=10/);
  assert.equal(binomialState(), untouchedBinomial, 'Drawing a sample must not update the binomial graph or readout');
  const untouchedCLT = cltState();
  binomialFields.bn.value = '1'; await binomialFields.bn.dispatch('input');
  assert.equal(binomialOutputs['bn-v'].textContent, '1');
  assert.equal(binomialSvg.children.filter(node => node.tag === 'rect').length, 2);
  assert.match(binomialReadout.textContent, /P\(Y≥18\)=0/);
  assert.equal(cltState(), untouchedCLT, 'A parent range update must leave the accumulated CLT sample intact');
  binomialFields.bk.value = '1'; await binomialFields.bk.dispatch('input');
  assert.equal(binomialOutputs['bk-v'].textContent, '1'); assert.match(binomialReadout.textContent, /P\(Y≥1\)=0.850000/);
  binomialFields.bp.value = '0.5'; await binomialFields.bp.dispatch('input');
  assert.equal(binomialOutputs['bp-v'].textContent, '0.5'); assert.match(binomialReadout.textContent, /P\(Y≥1\)=0.500000/);
  assert.equal(cltState(), untouchedCLT);
  const changedBinomial = binomialState();
  nestedN.value = '25'; await nestedN.dispatch('input');
  assert.match(nested['[data-clt-status]'].textContent, /n=25.*B=0.*nB=0/);
  assert.equal(binomialState(), changedBinomial, 'Changing CLT n must not alter binomial controls or outputs');
  await nested['[data-clt-action="hundred"]'].dispatch('click');
  assert.match(nested['[data-clt-status]'].textContent, /n=25.*B=100.*nB=2500/);
  assert.equal(binomialState(), changedBinomial);
} finally {
  for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
console.log('CLT: independent seed references, one/batch equivalence, n/B/nB, sample-to-mean lineage, R code, B=1, limit remainder, invalid/reset/copy lifecycle, SVG geometry and binomial integration passed.');
