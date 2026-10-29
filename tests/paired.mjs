import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pairedAnalysis, pairedRCode, drawPaired, mountPaired } from '../assets/paired.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} versus ${b}`);
const modes = ['correct', 'reorder', 'shuffle'], originalA = [8, 14, 20, 26, 32], originalB = [9, 16, 23, 28, 34];
const ids = ['P1', 'P2', 'P3', 'P4', 'P5'];
const cases = modes.flatMap(mode => ids.map(id => ({ mode, id })));
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-paired-'));
try {
  const script = cases.map(({ mode, id }, i) => `local({
a_ref <- c(8,14,20,26,32); b_ref <- c(9,16,23,28,34)
order_a_ref <- ${mode === 'reorder' ? '5:1' : '1:5'}
order_b_ref <- ${mode === 'correct' ? '1:5' : '5:1'}
a_ref <- a_ref[order_a_ref]; b_ref <- b_ref[order_b_ref]
d_ref <- b_ref-a_ref; se_ref <- sd(d_ref)/sqrt(length(d_ref))
cross_ref <- (a_ref-mean(a_ref))*(b_ref-mean(b_ref))
ss_ref <- (d_ref-mean(d_ref))^2
values_ref <- c(mean(a_ref),mean(b_ref),var(a_ref),var(b_ref),cov(a_ref,b_ref),
  cor(a_ref,b_ref),mean(d_ref),var(d_ref),var(a_ref)+var(b_ref)-2*cov(a_ref,b_ref),
  se_ref,sqrt(var(a_ref)/5+var(b_ref)/5),mean(d_ref)/se_ref,
  as.vector(t(cbind(order_a_ref-1,order_b_ref-1,a_ref,b_ref,d_ref,cross_ref,ss_ref))))
${mode !== 'shuffle' ? `test_ref <- t.test(b_ref,a_ref,paired=TRUE,mu=0,conf.level=.95)
values_ref <- c(values_ref,unname(test_ref$parameter),unname(test_ref$statistic),
                test_ref$p.value,qt(.975,4),unname(test_ref$conf.int))` : ''}
cat("PAIREDREF",${i},paste(sprintf("%.17g",values_ref),collapse=","),sep="\t");cat("\n")
invisible(capture.output({
${pairedRCode(mode, id)}
}))
stopifnot(identical(current$A,a_ref),identical(current$B,b_ref),
          identical(current$A_id,paste0("P",order_a_ref)),
          identical(current$B_id,paste0("P",order_b_ref)),
          identical(selected_A_id,"${id}"),
          abs(sample_covariance-cov(a_ref,b_ref))<1e-12,
          abs(se_arithmetic-se_ref)<1e-12,
          identical(valid_pairing,${mode !== 'shuffle' ? 'TRUE' : 'FALSE'}))
${mode !== 'shuffle' ? 'stopifnot(abs(paired_test$p.value-test_ref$p.value)<1e-12)' : 'stopifnot(!exists("paired_test",inherits=FALSE),!exists("difference_test",inherits=FALSE))'}
})`).join('\n');
  const path = join(temp, 'reference.R'); writeFileSync(path, script);
  const stdout = execFileSync(process.env.RSCRIPT || 'Rscript', [path], { encoding: 'utf8', maxBuffer: 1e6 });
  const lines = stdout.split('\n').filter(line => line.startsWith('PAIREDREF\t')); assert.equal(lines.length, cases.length);
  lines.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(Number), r = pairedAnalysis(cases[i].mode);
    const actual = [r.meanA, r.meanB, r.varA, r.varB, r.covariance, r.correlation, r.meanD, r.varD, r.identity, r.se, r.independentFormulaSE, r.ratio,
      ...r.rows.flatMap(row => [row.ai, row.bi, row.a, row.b, row.difference, row.crossProduct, row.squaredDeviation]),
      ...(r.inference ? [r.inference.df, r.inference.t, r.inference.p, r.inference.critical, r.inference.low, r.inference.high] : [])];
    assert.equal(actual.length, expected.length); actual.forEach((value, j) => close(value, expected[j]));
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

const original = pairedAnalysis(), reordered = pairedAnalysis('reorder'), mismatched = pairedAnalysis('shuffle');
assert.deepEqual(original.rows.map(row => row.difference), [1, 2, 3, 2, 2]);
assert.deepEqual(mismatched.rows.map(row => row.difference), [26, 14, 3, -10, -23]);
assert.equal(original.crossSum, 372); assert.equal(original.differenceSS, 2); assert.equal(original.varD, .5);
assert.equal(mismatched.crossSum, -372); assert.equal(mismatched.differenceSS, 1490); assert.equal(mismatched.varD, 372.5);
assert.equal(mismatched.inference, null); assert.equal(mismatched.validPairing, false);
assert.deepEqual(original.inference, reordered.inference); close(original.inference.p, .0031982021523353126);
for (const mode of modes) {
  const r = pairedAnalysis(mode);
  assert.equal(r.n, 5); assert.equal(r.meanA, 20); assert.equal(r.meanB, 22); assert.equal(r.meanD, 2);
  assert.equal(r.varA, 90); assert.equal(r.varB, 96.5); close(r.independentFormulaSE, 6.10737259384099);
  assert.deepEqual(r.rows.map(row => row.a).sort((a, b) => a - b), originalA);
  assert.deepEqual(r.rows.map(row => row.b).sort((a, b) => a - b), originalB);
  assert.deepEqual(r.rows.map(row => row.aId).sort(), ids); assert.deepEqual(r.rows.map(row => row.bId).sort(), ids);
  assert.equal(r.varD, r.identity); assert.equal(r.covariance, r.crossSum / 4); assert.equal(r.varD, r.differenceSS / 4);
  close(r.se ** 2, r.varD / 5); assert.equal(r.rows.filter(row => row.matched).length, mode === 'shuffle' ? 1 : 5);
  for (const row of r.rows) {
    assert.equal(row.a, originalA[ids.indexOf(row.aId)]); assert.equal(row.b, originalB[ids.indexOf(row.bId)]);
    assert.equal(row.difference, row.b - row.a);
    assert.equal(row.crossProduct, (row.a - 20) * (row.b - 22)); assert.equal(row.squaredDeviation, (row.difference - 2) ** 2);
  }
  if (mode !== 'shuffle') {
    assert.equal(r.covariance, original.covariance); assert.equal(r.varD, original.varD); assert.equal(r.se, original.se);
    assert.deepEqual([...r.rows].sort((a, b) => a.ai - b.ai).map(({ index, ...row }) => row), original.rows.map(({ index, ...row }) => row));
  }
}
const mutable = pairedAnalysis(); mutable.rows[0].a = 999; mutable.orderA[0] = 4; mutable.inference.p = 1;
assert.deepEqual(pairedAnalysis(), original);
for (const mode of ['', 'invalid', 'toString', null, 0, {}]) { assert.throws(() => pairedAnalysis(mode)); assert.throws(() => pairedRCode(mode)); }
for (const id of ['', 'P0', 'P6', null, 0]) assert.throws(() => pairedRCode('correct', id));
assert.doesNotMatch(pairedRCode('shuffle'), /t\.test\(|conf\.int/);
assert.match(pairedRCode('shuffle'), /Mismatched pair IDs: no inferential test/);

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
  const graph = new Element('svg'), canonicalPoints = {};
  for (const { mode, id } of cases) {
    const r = pairedAnalysis(mode); drawPaired(graph, r, id);
    const links = graph.children.filter(el => 'data-pair-link' in el.attrs), points = graph.children.filter(el => 'data-pair-point' in el.attrs);
    assert.equal(links.length, 5); assert.equal(points.length, 10); assert.equal(new Set(points.map(el => el.attrs['data-pair-point'])).size, 10);
    assert.equal(links.filter(el => el.attrs['data-selected'] === 'true').length, 1); assert.equal(points.filter(el => el.attrs['data-selected'] === 'true').length, 2);
    assert.equal(links.at(-1).attrs['data-pair-link'], id); // Selected link is visible above crossings.
    for (const row of r.rows) {
      const link = links.find(el => el.attrs['data-pair-link'] === row.aId);
      close(Number(link.attrs.y1), 302 - row.a / 40 * 250); close(Number(link.attrs.y2), 302 - row.b / 40 * 250);
      assert.equal(link.attrs['data-matched'], String(row.matched)); assert.equal(link.attrs['stroke-dasharray'], row.matched ? '' : '7 5');
    }
    for (const point of points) {
      const key = point.attrs['data-pair-point'], position = [point.attrs.cx, point.attrs.cy];
      if (!(key in canonicalPoints)) canonicalPoints[key] = position; else assert.deepEqual(position, canonicalPoints[key]);
      assert.ok(Number(point.attrs.cy) - Number(point.attrs.r) > 52 && Number(point.attrs.cy) + Number(point.attrs.r) < 302);
    }
    assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
    for (const el of graph.children) for (const key of ['x', 'x1', 'x2', 'cx']) if (key in el.attrs) assert.ok(Number(el.attrs[key]) >= 0 && Number(el.attrs[key]) <= 680);
    if (mode === 'shuffle') assert.match(graph.attrs['aria-label'], /不同原始 pair ID.*错误匹配/);
    else assert.match(graph.attrs['aria-label'], /所有连线保留相同 pair ID/);
  }
  drawPaired(graph, null); assert.equal(graph.children.length, 0); assert.match(graph.attrs['aria-label'], /等待/);
  const elements = {};
  for (const key of ['mode', 'reset', 'error', 'status', 'results', 'cross-sum', 'difference-ss', 'selected', 'identity', 'invariants', 'inference', 'copy', 'code', 'copy-status']) elements[`[data-pair-${key}]`] = new Element();
  for (const key of ['main', 'large']) elements[`[data-pair-plot="${key}"]`] = new Element('svg');
  for (let i = 0; i < 5; i++) {
    elements[`[data-pair-select="${i}"]`] = new Element('button'); elements[`[data-pair-table-row="${i}"]`] = new Element('tr');
    for (const key of ['a', 'b', 'difference', 'crossProduct', 'squaredDeviation']) elements[`[data-pair-cell="${i}-${key}"]`] = new Element('td');
  }
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-pair-${key}]`], select = i => elements[`[data-pair-select="${i}"]`];
  get('mode').value = 'correct'; mountPaired(root); mountPaired(root);
  const main = elements['[data-pair-plot="main"]'], large = elements['[data-pair-plot="large"]'];
  assert.equal(get('mode').events.change.length, 1); assert.equal(select(0).events.click.length, 1);
  assert.match(get('inference').textContent, /t=D̄\/SE≈6.3245553.*df=n−1=4.*P≈0.0031982022.*95% CI/);
  assert.match(get('identity').innerHTML, /372\/4=93/); assert.match(get('identity').innerHTML, /90\+96.5−2×\(93\)=0.5/);
  const stableMode = get('mode'), stableButton = select(3), stableRow = elements['[data-pair-table-row="3"]'];
  stableButton.focus(); await stableButton.dispatch('click');
  assert.equal(document.activeElement, stableButton); assert.equal(select(3), stableButton); assert.equal(elements['[data-pair-table-row="3"]'], stableRow);
  assert.match(get('selected').textContent, /A 的 P4=26.*B 的 P4=28/); assert.equal(select(3).attrs['aria-pressed'], 'true');
  assert.equal(get('code').textContent, pairedRCode('correct', 'P4'));
  get('mode').focus(); get('mode').value = 'reorder'; await get('mode').dispatch('change');
  assert.equal(get('mode'), stableMode); assert.equal(document.activeElement, stableMode);
  assert.match(get('selected').textContent, /当前第 2 行.*A 的 P4=26.*B 的 P4=28/); assert.equal(select(1).attrs['aria-pressed'], 'true');
  assert.equal(select(0).textContent, 'P5 → P5'); assert.equal(select(4).textContent, 'P1 → P1');
  assert.equal(get('code').textContent, pairedRCode('reorder', 'P4')); assert.match(get('status').textContent, /推断保持一致/);
  const validInference = get('inference').textContent;
  get('mode').value = 'shuffle'; await get('mode').dispatch('change');
  assert.match(get('selected').textContent, /当前第 4 行.*A 的 P4=26.*B 的 P2=16.*P4 原本对应的 B 值是 28/);
  assert.equal(select(3).attrs['aria-pressed'], 'true'); assert.match(get('identity').innerHTML, /−2×\(-93\)=372.5/);
  assert.match(get('inference').textContent, /算术比值/); assert.doesNotMatch(get('inference').textContent, /双侧 P≈|95% CI=/);
  assert.match(get('status').textContent, /有四行.*不提供.*正式 P/); assert.match(main.attrs['aria-label'], /错误匹配/);
  assert.equal(JSON.stringify(main.children), JSON.stringify(large.children));
  await get('copy').dispatch('click'); assert.equal(copied, pairedRCode('shuffle', 'P4')); assert.doesNotMatch(copied, /t\.test\(/); assert.match(get('copy-status').textContent, /不会进行正式/);
  await select(2).dispatch('click'); assert.match(get('selected').textContent, /P3=20.*P3=23.*保留原始 pair ID/);
  assert.match(get('status').textContent, /故意错误匹配/); assert.doesNotMatch(get('inference').textContent, /双侧 P≈|95% CI=/); // One surviving real pair does not validate the whole mapping.
  failCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中上方/); failCopy = false;
  waitCopy = true; const pending = get('copy').dispatch('click'); await get('reset').dispatch('click'); resolveCopy(); await pending; waitCopy = false;
  assert.equal(get('copy-status').textContent, ''); assert.equal(get('mode').value, 'correct'); assert.equal(select(0).attrs['aria-pressed'], 'true');
  assert.equal(get('inference').textContent, validInference); assert.equal(get('code').textContent, pairedRCode('correct', 'P1'));
  await get('copy').dispatch('click'); assert.equal(copied, pairedRCode('correct', 'P1')); assert.match(get('copy-status').textContent, /配对推断/);
  get('mode').value = 'invalid'; await get('mode').dispatch('change');
  assert.equal(get('results').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(select(0).disabled, true); assert.equal(get('code').textContent, '');
  assert.equal(main.children.length, 0); assert.equal(large.children.length, 0); assert.match(get('error').textContent, /当前不显示旧结果/);
  await get('reset').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(get('copy').disabled, false); assert.equal(select(0).disabled, false); assert.equal(get('error').textContent, '');
  assert.equal(get('code').textContent, pairedRCode('correct', 'P1'));
  assert.match(root.innerHTML, /匹配的两个不同单位/); assert.match(root.innerHTML, /不能靠排序/);
  assert.match(root.innerHTML, /n=5 指五个独立 pairs/); assert.match(root.innerHTML, /A−B 与本实验 B−A/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log('Paired: all three mappings × five selected IDs independently checked in R, current exported scripts executed; ID/data/whole-row invariants, covariance contributions, formal-inference suppression, fixed-axis geometry, selection/focus stability, invalid recovery and copy lifecycle passed.');
