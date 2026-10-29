import assert from 'node:assert/strict';
import { conditionalExamples, mountConditionalLab } from '../assets/conditional.mjs';

// Exercise the real mount/update functions without a browser dependency.
// This small DOM substitute checks generated SVG geometry and state changes;
// it does not claim to test browser layout, font metrics, or accessibility APIs.
const attributes = source => Object.fromEntries(
  [...source.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(match => [match[1], match[2] ?? ''])
);

class Element {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = attrs;
    this.value = attrs.value ?? '';
    this.disabled = false;
    this.listeners = new Map();
    this.dataset = Object.fromEntries(Object.entries(attrs)
      .filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value]));
    this.markup = '';
  }
  set innerHTML(value) { this.markup = value; this.plainText = null; }
  get innerHTML() { return this.markup; }
  set textContent(value) { this.markup = value; this.plainText = value; }
  get textContent() { return this.plainText ?? this.markup.replace(/<[^>]*>/g, ''); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  replaceChildren() { this.markup = ''; this.plainText = ''; }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  emit(type) { for (const handler of this.listeners.get(type) ?? []) handler(); }
  matches(selector) {
    const attribute = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (attribute) return Object.hasOwn(this.attrs, attribute[1]) &&
      (attribute[2] === undefined || this.attrs[attribute[1]] === attribute[2]);
    return this.tag === selector;
  }
}

class Root extends Element {
  constructor() {
    super('section');
    this.classList = { add() {} };
    this.nodes = [];
  }
  set innerHTML(value) {
    this.markup = value;
    this.nodes = [...value.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)]
      .map(match => new Element(match[1], attributes(match[2])));
    for (const select of value.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
      const attrs = attributes(select[1]);
      const key = Object.keys(attrs).find(name => name.startsWith('data-'));
      this.querySelector(`[${key}]`).value = select[2].match(/<option value="([^"]*)"/)[1];
    }
  }
  get innerHTML() { return this.markup; }
  querySelectorAll(selector) {
    return this.nodes.filter(node => selector.split(',').some(part => node.matches(part.trim())));
  }
  querySelector(selector) {
    const node = this.querySelectorAll(selector)[0];
    assert.ok(node, `The mounted markup is missing ${selector}`);
    return node;
  }
}

const root = new Root();
mountConditionalLab(root);
const $ = selector => root.querySelector(selector);
const inputs = root.querySelectorAll('[data-count]');
assert.equal(inputs.length, 6);
assert.equal(root.dataset.ready, 'true');
// Re-mounting must preserve the current controls and avoid duplicate listeners.
mountConditionalLab(root);
assert.equal($('[data-count="0-0"]'), inputs[0]);
assert.equal(inputs[0].listeners.get('input').length, 1);

function setState(counts, row, column, direction) {
  inputs.forEach((input, i) => { input.value = String(counts.flat()[i]); });
  $('[data-conditional-row]').value = String(row);
  $('[data-conditional-column]').value = String(column);
  $('[data-conditional-direction]').value = direction;
  inputs[0].emit('input');
}

function close(actual, expected, message) {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-10,
    `${message}: ${actual} versus ${expected}`);
}

function checkRenderedState(counts, row, column, direction) {
  setState(counts, row, column, direction);
  assert.equal($('[data-conditional-error]').textContent, '');
  const total = counts.flat().reduce((a, b) => a + b, 0);
  const a = counts[row].reduce((x, y) => x + y, 0);
  const b = counts[0][column] + counts[1][column];
  const intersection = counts[row][column];
  const denominator = direction === 'A' ? a : b;
  const independent = BigInt(intersection) * BigInt(total) === BigInt(a) * BigInt(b);
  assert.equal($('[data-grand-total]').textContent, String(total));
  counts.forEach((values, r) => assert.equal($(`[data-row-total="${r}"]`).textContent,
    String(values.reduce((x, y) => x + y, 0))));
  for (let c = 0; c < 3; c++) assert.equal($(`[data-column-total="${c}"]`).textContent,
    String(counts[0][c] + counts[1][c]));
  const result = $('[data-conditional-result]').textContent;
  assert.ok(result.includes(direction === 'B' ? 'P(A | B)' : 'P(B | A)'));
  assert.ok(result.includes(denominator ? `${intersection} / ${denominator}` : '未定义（条件集合为空）'));
  assert.ok($('[data-conditional-independence]').textContent.includes(independent
    ? '二者相等，所以这两个事件独立' : '二者不等，所以这两个事件不独立'));
  if (!a || !b) assert.ok($('[data-conditional-independence]').textContent.includes('条件的概率仍未定义'));
  assert.equal($('[data-conditional-copy]').disabled, false);
  assert.ok($('[data-conditional-code]').textContent.includes('counts <- matrix('));

  const svg = $('svg').innerHTML;
  const rectangles = [...svg.matchAll(/<rect\b([^>]*?)(?:\/>|><title>([^<]*)<\/title><\/rect>)/g)]
    .map(match => ({ ...attributes(match[1]), title: match[2] }));
  const frame = rectangles.find(rect => rect.fill === 'none');
  assert.ok(frame, 'The plot must retain its full-table frame');
  const plotArea = Number(frame.width) * Number(frame.height);
  const cells = rectangles.filter(rect => rect.title !== undefined);
  const expectedCellCount = [0, 1, 2].filter(c => counts[0][c] + counts[1][c] > 0).length * 2;
  assert.equal(cells.length, expectedCellCount);
  let allArea = 0, conditionalArea = 0, jointArea = 0;
  const seen = new Set();
  for (const cell of cells) {
    const r = cell.title.startsWith('nonfraud') ? 1 : 0;
    const c = ['fire', 'auto', 'theft'].indexOf(cell.title.match(/ \/ (fire|auto|theft)/)?.[1]);
    assert.ok(c >= 0, 'Every cell must identify its column in its title');
    assert.ok(!seen.has(`${r}-${c}`), 'A table cell must not be drawn twice');
    seen.add(`${r}-${c}`);
    const area = Number(cell.width) * Number(cell.height);
    close(area / plotArea, counts[r][c] / total, 'Each cell area represents its own joint probability');
    assert.ok(Number(cell.width) >= 0 && Number(cell.height) >= 0);
    assert.ok(Number(cell.x) >= Number(frame.x) - 1e-10 && Number(cell.y) >= Number(frame.y) - 1e-10);
    assert.ok(Number(cell.x) + Number(cell.width) <= Number(frame.x) + Number(frame.width) + 1e-10);
    assert.ok(Number(cell.y) + Number(cell.height) <= Number(frame.y) + Number(frame.height) + 1e-10);
    const isJoint = r === row && c === column;
    const isIncluded = direction === 'B' ? c === column : r === row;
    assert.equal(cell.fill, isJoint ? '#086f68' : isIncluded ? '#bbd8ca' : '#e7e8e3');
    allArea += area;
    if (cell.fill === '#086f68') jointArea += area;
    if (cell.fill === '#086f68' || cell.fill === '#bbd8ca') conditionalArea += area;
  }
  close(allArea / plotArea, 1, 'Cells fill the complete table');
  close(jointArea / plotArea, intersection / total, 'Dark area represents the intersection');
  close(conditionalArea / plotArea, denominator / total, 'Colored area represents the selected condition');
  const hatching = rectangles.filter(rect => rect.fill === 'url(#conditional-intersection)');
  assert.equal(hatching.length, intersection > 0 ? 1 : 0);
  if (hatching.length) close(Number(hatching[0].width) * Number(hatching[0].height) / plotArea,
    intersection / total, 'Hatching covers the intersection');
  if (!denominator) assert.ok($('svg').getAttribute('aria-label').includes('条件概率未定义'));
}

let exhaustiveStates = 0;
// Every nonempty 2x3 table with cell counts 0, 1, or 2; both conditioning directions.
for (let encoded = 1; encoded < 3 ** 6; encoded++) {
  let remaining = encoded;
  const values = Array.from({ length: 6 }, () => {
    const value = remaining % 3;
    remaining = Math.floor(remaining / 3);
    return value;
  });
  const counts = [values.slice(0, 3), values.slice(3)];
  for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
    for (const direction of ['A', 'B']) {
      checkRenderedState(counts, row, column, direction);
      exhaustiveStates++;
    }
  }
}
assert.equal(exhaustiveStates, 8736);

// Include the allowed upper bound and highly unbalanced tables.
const extremeTables = [
  [[10000, 10000, 10000], [10000, 10000, 10000]],
  [[1, 10000, 10000], [0, 10000, 10000]],
  [[10000, 10000, 9999], [0, 0, 1]],
  [[10000, 10000, 7000], [10000, 10000, 0]]
];
for (const counts of extremeTables) for (let row = 0; row < 2; row++) {
  for (let column = 0; column < 3; column++) for (const direction of ['A', 'B']) {
    checkRenderedState(counts, row, column, direction);
  }
}

// An invalid edit must remove stale results, SVG, totals, and downloadable code.
for (const invalid of ['', '-1', '.5', '10001', 'all-zero']) {
  setState(conditionalExamples.original, 0, 0, 'B');
  if (invalid === 'all-zero') inputs.forEach(input => { input.value = '0'; });
  else inputs[0].value = invalid;
  inputs[0].emit('input');
  assert.ok($('[data-conditional-error]').textContent.length > 0);
  assert.equal($('[data-conditional-result]').textContent, '等待有效频数。');
  assert.equal($('[data-conditional-probabilities]').textContent, '');
  assert.equal($('[data-conditional-independence]').textContent, '');
  assert.equal($('[data-conditional-code]').textContent, '');
  assert.equal($('[data-conditional-copy]').disabled, true);
  assert.equal($('svg').innerHTML, '');
  assert.equal($('svg').getAttribute('aria-label'), '等待有效频数。');
  for (const node of root.querySelectorAll('[data-row-total],[data-column-total],[data-grand-total]')) {
    assert.equal(node.textContent, '—');
  }
  checkRenderedState(conditionalExamples.original, 0, 0, 'B');
}

console.log(`${exhaustiveStates} mounted contingency states, 48 extreme states, and invalid-input recovery passed.`);
