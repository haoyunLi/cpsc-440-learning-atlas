import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as M from '../assets/math.mjs';

// Run the actual chapter mount and handlers. The fixture checks SVG geometry,
// not native browser layout or animation timing.
class Element {
  constructor(id = '') {
    this.id = id;
    this.children = [];
    this.attrs = {};
    this.events = {};
    this.value = '';
    this.textContent = '';
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  append(node) { this.children.push(node); }
  replaceChildren() { this.children = []; }
  addEventListener(type, handler) { (this.events[type] ??= []).push(handler); }
  emit(type) { for (const handler of this.events[type] ?? []) handler(); }
}

const source = readFileSync(new URL('../assets/atlas.mjs', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/\bexport /g, '') +
  '\nglobalThis.mountChapterCI = labInference;';
function fixture() {
  const nodes = new Map();
  const settings = { in: 25, is: 10, id: 4, ia: .01, tail: 'right' };
  const controls = Object.entries(settings).map(([id, value]) => {
    const node = new Element(id);
    node.value = String(value);
    nodes.set(`#${id}`, node);
    return node;
  });
  const root = {
    innerHTML: '',
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, new Element());
      return nodes.get(selector);
    },
    querySelectorAll(selector) {
      return selector === 'input[type=range]' || selector === '.controls input'
        ? controls.filter(node => node.id !== 'tail') : controls;
    }
  };
  const timers = new Map();
  let timerID = 0;
  const document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    createElementNS: (_, tag) => Object.assign(new Element(), { tag }),
    addEventListener() {}
  };
  const context = {
    M, document, window: { addEventListener() {} },
    setInterval(handler) { timers.set(++timerID, handler); return timerID; },
    clearInterval(id) { timers.delete(id); }
  };
  vm.runInNewContext(source, context);
  context.mountChapterCI(root);
  return {
    root, nodes, timers,
    change(id, value) { nodes.get(`#${id}`).value = String(value); nodes.get(`#${id}`).emit('input'); },
    step() { nodes.get('#ci-step').onclick(); },
    reset() { nodes.get('#ci-reset').onclick(); }
  };
}

const near = (actual, expected, message, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance,
    `${message}: ${actual} versus ${expected}`);
};

function checkGeometry(state, expected, se, halfWidth) {
  const svg = state.nodes.get('#ci-plot svg');
  const intervals = svg.children.filter(node => node.tag === 'line' && node.attrs['stroke-width'] === 2);
  const points = svg.children.filter(node => node.tag === 'circle');
  const shown = expected.slice(-24);
  assert.equal(intervals.length, shown.length);
  assert.equal(points.length, shown.length);
  // Recover the affine axis mapping from a complete interval. Comparing every
  // other endpoint and center detects clipping or altered interval lengths.
  const scale = (intervals[0].attrs.x2 - intervals[0].attrs.x1) / (2 * halfWidth);
  const origin = intervals[0].attrs.x1 - scale * (shown[0] - halfWidth);
  const xmin = (85 - origin) / scale, xmax = (635 - origin) / scale;
  assert.ok(Number.isFinite(xmin) && Number.isFinite(xmax) && scale > 0);
  assert.ok(xmin <= -5 * se + 1e-8 && xmax >= 5 * se - 1e-8);
  assert.ok(xmin < Math.min(...shown) - halfWidth && xmax > Math.max(...shown) + halfWidth,
    'The displayed endpoints need space on both sides');
  shown.forEach((mean, i) => {
    const line = intervals[i].attrs, point = points[i].attrs;
    near(line.x1, origin + scale * (mean - halfWidth), 'Complete lower endpoint');
    near(line.x2, origin + scale * (mean + halfWidth), 'Complete upper endpoint');
    near(point.cx, origin + scale * mean, 'Unchanged sample-mean marker');
    near((line.x1 + line.x2) / 2, point.cx, 'The interval remains centered on the mean');
    assert.ok(line.x1 > 85 && line.x2 < 635, 'No endpoint can escape the plot frame');
    assert.ok(point.cx - point.r > 85 && point.cx + point.r < 635);
    assert.ok(point.cy - point.r > 45 && point.cy + point.r < 265);
    assert.ok(line.y1 > 45 && line.y2 < 265);
    assert.equal(line.stroke, Math.abs(mean) <= halfWidth ? '#086f68' : '#9a472e');
    assert.equal(line['stroke-dasharray'], Math.abs(mean) <= halfWidth ? '' : '4 3');
  });
  return { xmin, xmax };
}

const state = fixture();
assert.match(state.root.innerHTML, /横轴通常保持 ±5SE/);
assert.match(state.root.innerHTML, /显示最新区间的完整端点/);
assert.match(state.root.innerHTML, /最多 1000 条/);
let rng = M.seeded(440), expected = [];
const se = 2, halfWidth = M.normalQuantile(.995) * se;
const independentRMeans = new Map([[152, 2.9212463818979475 * 2], [5932, 3.458399954609667 * 2]]);
for (let i = 1; i <= 5932; i++) {
  expected.push(M.randomNormal(rng) * se);
  state.step();
  const domain = checkGeometry(state, expected, se, halfWidth);
  if (i === 1) {
    near(domain.xmin, -10, 'Ordinary intervals retain the original lower limit');
    near(domain.xmax, 10, 'Ordinary intervals retain the original upper limit');
  }
  if (independentRMeans.has(i)) {
    // R reference: the same integer LCG and Box-Muller calculation, qnorm(.995).
    near(expected.at(-1), independentRMeans.get(i), 'Independent R sample mean', 1e-12);
    const rUpper = expected.at(-1) + 2 * 2.5758293035489004;
    assert.ok(domain.xmax > rUpper);
    assert.ok(domain.xmax > 10, `Sample ${i} requires axis expansion`);
  }
}

function assertReset(state) {
  assert.equal(state.nodes.get('#ci-plot svg').children.length, 0);
  assert.equal(state.nodes.get('#ci-readout').textContent, '尚未生成 intervals');
  assert.equal(state.timers.size, 0);
  assert.equal(state.nodes.get('#ci-play').textContent, '播放 50 个 intervals');
}

// Changing n, sigma, or alpha clears the history, cancels playback and resets
// the seed. Test all corners of their allowed UI ranges.
let boundaryStates = 0;
for (const n of [4, 200]) for (const sigma of [1, 20]) for (const alpha of [.01, .2]) {
  for (const [id, value] of [['in', n], ['is', sigma], ['ia', alpha]]) {
    state.nodes.get('#ci-play').onclick();
    assert.equal(state.timers.size, 1);
    state.change(id, value);
    assertReset(state);
  }
  const currentSE = sigma / Math.sqrt(n), half = M.normalQuantile(1 - alpha / 2) * currentSE;
  rng = M.seeded(440);
  expected = [];
  for (let i = 0; i < 250; i++) {
    expected.push(M.randomNormal(rng) * currentSE);
    state.step();
    checkGeometry(state, expected, currentSE, half);
    boundaryStates++;
  }
}
state.reset();
assertReset(state);

console.log(`CI geometry passed through seeded samples 152 and 5932, plus ${boundaryStates} boundary states; full endpoints/markers, stable minimum domain and parameter resets verified.`);
