import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { kruskalAnalysis, kruskalRCode, parseKruskalValue, drawKruskal, mountKruskal } from '../assets/kruskal.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const split = values => [values.slice(0, 3), values.slice(3, 6), values.slice(6)];
const defaults = [[4, 5, 6], [7, 8, 9], [10, 11, 12]], tied = [[1, 1, 2], [2, 3, 4], [4, 5, 5]];
const cases = [defaults, tied,
  [[0, 0, 0], [0, 0, 0], [0, 0, 1]], // Every allocation has the same H, despite C>0.
  [[1, 1, 1], [2, 2, 2], [3, 3, 3]],
  [[1, 5, 9], [2, 6, 7], [3, 4, 8]],
  [[-1e6, 0, 1e6], [-2, 0, 2], [-1, 0, 1]],
  split(Array.from({ length: 9 }, (_, i) => 1 + i * Number.EPSILON)),
  split(Array.from({ length: 9 }, (_, i) => 1 + i * 1e-14)),
  split(Array.from({ length: 9 }, (_, i) => (i + 1) * 1e-200)),
  [[1, 3, 3], [2, 2, 3], [1, 1, 4]]];
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-kruskal-'));
try {
  const blocks = cases.map((groups, i) => `local({
y_ref <- ${i === 6 ? '1+(0:8)*.Machine$double.eps' : `c(${groups.flat().join(',')})`}
rank_ref <- rank(y_ref,ties.method="average")
ties_ref <- rle(sort(y_ref))$lengths
c_ref <- 1-sum(ties_ref^3-ties_ref)/720
# Base R's table(x) can conflate adjacent doubles. Testing pooled ranks keeps
# precisely the same rank statistic and tie groups while avoiding that bug.
observed_ref <- kruskal.test(split(rank_ref,rep(1:3,each=3)))
h_ref <- unname(observed_ref$statistic)
p_ref <- observed_ref$p.value
# Independent reference: fit base R's test for every allocated data set.
h_all_ref <- numeric(1680); q_ref <- 0L
for (a_ref in combn(1:9,3,simplify=FALSE)) {
  remaining_ref <- setdiff(1:9,a_ref)
  for (b_ref in combn(remaining_ref,3,simplify=FALSE)) {
    cc_ref <- setdiff(remaining_ref,b_ref); q_ref <- q_ref+1L
    h_all_ref[q_ref] <- unname(kruskal.test(list(rank_ref[a_ref],rank_ref[b_ref],rank_ref[cc_ref]))$statistic)
  }
}
# Only the independent floating-point reference needs a boundary tolerance.
# Production tail counting uses exact integer doubled-rank scores.
tail_ref <- sum(h_all_ref>=h_ref-1e-12)
cat("KWREF",${i},paste(sprintf("%.17g",c(rank_ref,c_ref,h_ref,p_ref,tail_ref)),collapse=","),sep="\t");cat("\n")
cat("KWHIST",${i},paste(sprintf("%.17g",h_all_ref),collapse=","),sep="\t");cat("\n")
exported <- local({
  invisible(capture.output({
${kruskalRCode(groups)}
  }))
  list(H=H,C=C,p=p_approx,tail=tail_count,H_all=H_reference,y=y)
})
stopifnot(abs(exported$H-h_ref)<1e-10,abs(exported$C-c_ref)<1e-12,
          abs(exported$p-p_ref)<1e-10,exported$tail==tail_ref,
          max(abs(exported$H_all-h_all_ref))<1e-10)
if (${i}==6) stopifnot(identical(exported$y,y_ref))
})`).join('\n');
  const file = join(temp, 'reference.R'); writeFileSync(file, blocks);
  const output = execFileSync(process.env.RSCRIPT || 'Rscript', [file], { encoding: 'utf8', maxBuffer: 2e6 });
  const rows = output.split('\n').filter(line => line.startsWith('KWREF\t'));
  const histograms = output.split('\n').filter(line => line.startsWith('KWHIST\t'));
  assert.equal(rows.length, cases.length); assert.equal(histograms.length, cases.length);
  rows.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(Number), result = kruskalAnalysis(cases[i]);
    [...result.scores, result.correction, result.h, result.approximateP, result.tailCount].forEach((value, j) => close(value, expected[j]));
    const allH = histograms[i].split('\t')[2].split(',').map(Number);
    assert.equal(allH.length, 1680); result.allocations.forEach((allocation, j) => close(allocation.h, allH[j]));
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

const original = kruskalAnalysis(defaults), ties = kruskalAnalysis(tied);
assert.deepEqual(original.rankSums, [6, 15, 24]); assert.equal(original.h, 7.2); assert.equal(original.tailCount, 6);
close(original.approximateP, .02732372244729256); assert.equal(original.exactP, 1 / 280);
assert.deepEqual(ties.rankSums, [6.5, 15, 23.5]); assert.equal(ties.tieSum, 24); close(ties.correction, 29 / 30);
close(ties.rawH, 6.422222222222222); close(ties.h, 6.64367816091954); assert.equal(ties.tailCount, 24); assert.equal(ties.exactP, 1 / 70);
const flat = kruskalAnalysis([[0, 0, 0], [0, 0, 0], [0, 0, 1]]);
assert.equal(flat.frequencies.length, 1); assert.equal(flat.exactP, 1); assert.equal(flat.h, 2);
const constant = [[.1, .1, .1], [.1, .1, .1], [.1, .1, .1]], emptyInfo = kruskalAnalysis(constant);
assert.equal(emptyInfo.informative, false); assert.equal(emptyInfo.correction, 0); assert.equal(emptyInfo.h, null); assert.equal(emptyInfo.exactP, null); assert.equal(emptyInfo.approximateP, null);
assert.throws(() => kruskalRCode(constant), /C=0/);
for (const groups of cases) {
  const result = kruskalAnalysis(groups), histogramCount = result.frequencies.reduce((total, bin) => total + bin.count, 0);
  assert.equal(histogramCount, 1680); assert.equal(result.total, 1680); assert.equal(result.scores.reduce((a, b) => a + b), 45);
  assert.equal(new Set(result.rows.map(row => row.id)).size, 9); assert.equal(result.allocations[0].score, result.observedScore);
  assert.equal(new Set(result.allocations.map(a => a.members.map(group => group.join(',')).join('|'))).size, 1680);
  result.allocations.forEach(allocation => {
    assert.ok(Number.isInteger(allocation.score)); assert.equal(allocation.inTail, allocation.score >= result.observedScore);
    assert.ok(allocation.h >= 0 && allocation.h <= 8); assert.equal(new Set(allocation.members.flat()).size, 9);
    assert.deepEqual(allocation.members.map(group => group.length), [3, 3, 3]);
  });
  // Group names, within-group observation order and monotone scale changes do
  // not alter this nondirectional omnibus statistic or its reference tail.
  for (const changed of [[groups[2], groups[0], groups[1]], groups.map(group => [...group].reverse()), groups.map(group => group.map(value => -value))]) {
    const other = kruskalAnalysis(changed); close(other.h, result.h); assert.equal(other.tailCount, result.tailCount);
  }
}
for (const input of ['', ' ', 'NaN', 'Infinity', '1,2', '0x10', '1000001', '1e-400', '-1e-999']) assert.throws(() => parseKruskalValue(input));
for (const [input, value] of [['-1.5', -1.5], ['0e-999', 0], ['.1', .1], ['1e-200', 1e-200]]) assert.equal(parseKruskalValue(input), value);
for (const groups of [[], [[1, 2, 3], [4, 5, 6]], [[1, 2], [3, 4, 5], [6, 7, 8]], [[1, 2, NaN], [4, 5, 6], [7, 8, 9]], [[1, 2, 1e7], [4, 5, 6], [7, 8, 9]]]) assert.throws(() => kruskalAnalysis(groups));

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
let copied = '', failCopy = false, pendingResolve = null, waitCopy = false;
globalThis.document = { activeElement: null, createElementNS: (namespace, tag) => new Element(tag) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (failCopy) throw Error('denied'); copied = text; if (waitCopy) await new Promise(resolve => { pendingResolve = resolve; }); } } } });
try {
  const graph = new Element('svg');
  for (const groups of cases) {
    const result = kruskalAnalysis(groups);
    for (const index of [0, 839, 1679]) {
      drawKruskal(graph, result, index);
      const bars = graph.children.filter(el => 'data-kw-bin' in el.attrs);
      assert.equal(bars.length, result.frequencies.length);
      bars.forEach(bar => {
        assert.ok(+bar.attrs.width > 0 && +bar.attrs.height > 0);
        assert.ok(+bar.attrs.x >= 76 && +bar.attrs.x + +bar.attrs.width <= 620);
        assert.ok(+bar.attrs.y >= 44 && +bar.attrs.y + +bar.attrs.height <= 238 + 1e-10);
      });
      assert.equal(bars.filter(el => +el.attrs['stroke-width'] === 3).length, 1);
      const ticks = graph.children.filter(el => el.attrs.class === 'kw-tick' && el.attrs['text-anchor'] === 'end').map(el => el.textContent);
      assert.equal(new Set(ticks).size, 5); assert.ok(ticks.every(value => Number.isInteger(Number(value))));
      assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    }
  }
  drawKruskal(graph, emptyInfo); assert.equal(graph.children.length, 0);
  assert.throws(() => drawKruskal(graph, original, 1680), /序号/);

  const elements = {}, fields = [];
  for (let i = 0; i < 9; i++) { const field = Object.assign(new Element('input'), { value: String(defaults.flat()[i]) }); fields.push(field); elements[`[data-kw-value="${Math.floor(i / 3)}-${i % 3}"]`] = field; }
  for (const key of ['error', 'results', 'inference', 'ties', 'ranks', 'result', 'plot', 'step', 'prev', 'next', 'index', 'current', 'frequency', 'copy', 'code', 'copy-status']) elements[`[data-kw-${key}]`] = new Element(key === 'plot' ? 'svg' : 'div');
  for (const key of ['ties', 'reset']) elements[`[data-kw-action="${key}"]`] = new Element('button');
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-kw-${key}]`], action = key => elements[`[data-kw-action="${key}"]`];
  mountKruskal(root); mountKruskal(root);
  assert.equal(fields[0].events.input.length, 1); assert.equal(action('reset').events.click.length, 1);
  assert.match(get('result').textContent, /H=7.2.*6\/1680/); assert.equal(get('prev').disabled, true);
  const fixedResult = get('result').textContent, code = get('code').textContent, frequency = get('frequency'), firstField = fields[0];
  firstField.focus(); get('step').value = '1680'; await get('step').dispatch('input');
  assert.equal(get('result').textContent, fixedResult); assert.equal(get('code').textContent, code); assert.equal(get('frequency'), frequency);
  assert.equal(get('next').disabled, true); assert.equal(document.activeElement, firstField); assert.match(get('current').textContent, /参考分配 1680/);
  await get('prev').dispatch('click'); assert.equal(get('step').value, '1679'); await get('next').dispatch('click'); assert.equal(get('step').value, '1680');
  await action('ties').dispatch('click'); assert.match(get('result').textContent, /24\/1680/); assert.equal(get('step').value, '1');
  assert.match(get('ranks').innerHTML, /A1/); assert.match(get('ranks').innerHTML, /A2/); assert.equal((get('ranks').innerHTML.match(/<tr>/g) || []).length, 9);
  assert.equal(document.activeElement, firstField); assert.equal(fields[0], firstField);
  await get('copy').dispatch('click'); assert.equal(copied, kruskalRCode(tied)); assert.match(get('copy-status').textContent, /已复制/);
  failCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中/); failCopy = false;
  waitCopy = true; const pendingCopy = get('copy').dispatch('click'); await action('reset').dispatch('click'); pendingResolve(); await pendingCopy; waitCopy = false;
  assert.equal(get('copy-status').textContent, '');
  fields.forEach(field => field.value = '.1'); await fields[0].dispatch('input');
  assert.equal(get('results').hidden, false); assert.equal(get('inference').hidden, true); assert.match(get('result').textContent, /C=0.*0\/0/);
  assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, ''); assert.equal(get('plot').children.length, 0); assert.equal(get('step').disabled, true);
  await action('reset').dispatch('click'); assert.equal(get('inference').hidden, false); assert.equal(get('copy').disabled, false); assert.equal(get('step').disabled, false);
  for (const invalid of ['', ' ', 'NaN', '1000001', '1e-400']) {
    fields[0].value = invalid; await fields[0].dispatch('input');
    assert.equal(get('results').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, ''); assert.equal(get('plot').children.length, 0);
    if (invalid === '1e-400') assert.match(get('error').textContent, /不能自动当成 0/);
    await action('ties').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(get('step').value, '1');
  }
  assert.match(root.innerHTML, /相关或配对数据不能直接这样洗牌/); assert.match(root.innerHTML, /整体、无方向性/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log(`Kruskal–Wallis: ${cases.length} data sets independently checked against base R for all 1680 allocations each; exact tail multiplicity, adjacent doubles, executable R exports, valid discrete SVG, stable controls, invalid/constant recovery and copy lifecycle passed.`);
