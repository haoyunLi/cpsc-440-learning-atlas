import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allocateDesign, summarizeAllocation, designSpaces, parseRandomizationSeed, randomizationRCode, mountRandomization } from '../assets/randomization.mjs';

const close = (a, b, tolerance = 1e-12) => assert.ok(Math.abs(a - b) < tolerance, `${a} versus ${b}`);
const choose = (values, count, start = 0, selected = [], result = []) => {
  if (!count) { result.push([...selected]); return result; }
  for (let i = start; i <= values.length - count; i++) { selected.push(values[i]); choose(values, count - 1, i + 1, selected, result); selected.pop(); }
  return result;
};
// Count the legal CRD sample space independently, assigning five distinct IDs
// to A, five remaining IDs to B and the rest to C. Do not infer this count
// from observed pseudo-random seeds.
const ids = Array.from({ length: 15 }, (_, i) => i), picks = choose(ids, 5);
let crdCount = 0, balancedCount = 0;
for (const a of picks) {
  const remaining = ids.filter(id => !a.includes(id));
  const aBalanced = new Set(a.map(id => Math.floor(id / 3))).size === 5;
  for (const b of choose(remaining, 5)) {
    crdCount++;
    if (aBalanced && new Set(b.map(id => Math.floor(id / 3))).size === 5) balancedCount++;
  }
}
// Independently construct all RCBD assignments from the six orders of A/B/C.
const orders = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
let products = [''];
for (let block = 0; block < 5; block++) products = products.flatMap(prefix => orders.map(order => prefix + order));
assert.equal(new Set(products).size, 7776); assert.equal(crdCount, 756756); assert.equal(balancedCount, 7776);
assert.deepEqual(designSpaces(), { rcbd: products.length, crd: crdCount, balancedProbability: balancedCount / crdCount });
close(designSpaces().balancedProbability, 72 / 7007);

// Independent BigInt implementation verifies the deterministic teaching seed
// sequence and shuffle boundaries without importing the production RNG.
function independentLabels(mode, seed) {
  let state = BigInt(seed);
  const random = () => { state = (1664525n * state + 1013904223n) % 4294967296n; return (Number(state) + .5) / 4294967296; };
  const mix = values => { const out = [...values]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  return mode === 'rcbd' ? Array.from({ length: 5 }, () => mix(['A', 'B', 'C'])).flat() : mix(['A', 'B', 'C'].flatMap(t => Array(5).fill(t)));
}
const seeds = [0, 1, 26, 70, 440, 441, 123456789, 4294967295];
const cases = seeds.flatMap(seed => ['rcbd', 'crd'].map(mode => allocateDesign({ mode, seed })));
let sawUnequal = false;
for (const allocation of [...cases, ...Array.from({ length: 100 }, (_, seed) => allocateDesign({ mode: 'crd', seed }))]) {
  const summary = summarizeAllocation(allocation);
  assert.deepEqual(allocation.units.map(unit => unit.treatment), independentLabels(allocation.mode, allocation.seed));
  assert.equal(new Set(allocation.units.map(unit => unit.id)).size, 15);
  assert.deepEqual(summary.rows.map(row => row.total), [5, 5, 5]);
  for (let b = 0; b < 5; b++) assert.equal(summary.rows.reduce((sum, row) => sum + row.counts[b], 0), 3);
  summary.rows.forEach(row => close(row.meanEnvironment, row.counts.reduce((sum, count, b) => sum + count * (2 - b), 0) / 5));
  close(summary.rows.reduce((sum, row) => sum + row.meanEnvironment, 0), 0);
  if (allocation.mode === 'rcbd') { assert.equal(summary.balanced, true); assert.deepEqual(summary.rows.map(row => row.meanEnvironment), [0, 0, 0]); }
  else if (!summary.balanced) sawUnequal = true;
  assert.deepEqual(allocateDesign({ mode: allocation.mode, seed: allocation.seed }), allocation);
}
assert.equal(sawUnequal, true);
const rcbd = allocateDesign({ mode: 'rcbd', seed: 440 }), crd = allocateDesign({ mode: 'crd', seed: 440 });
const physical = allocation => allocation.units.map(({ treatment, ...unit }) => unit);
assert.deepEqual(physical(rcbd), physical(crd));
assert.deepEqual(summarizeAllocation(crd).rows.map(row => row.meanEnvironment), [0, .2, -.2]);
const selectedBalanced = allocateDesign({ mode: 'crd', seed: 26 });
assert.equal(selectedBalanced.mode, 'crd'); assert.equal(summarizeAllocation(selectedBalanced).balanced, true);
const meanOnly = summarizeAllocation(allocateDesign({ mode: 'crd', seed: 70 }));
assert.deepEqual(meanOnly.rows.map(row => row.meanEnvironment), [0, 0, 0]); assert.equal(meanOnly.balanced, false);
for (const raw of ['', ' ', '-1', '1.5', '4294967296', 'Infinity', 'NaN', '1e3', '0x10']) assert.throws(() => parseRandomizationSeed(raw));
for (const seed of [0, 26, 4294967295]) assert.equal(parseRandomizationSeed(String(seed)), seed);
for (const settings of [{ mode: 'unknown', seed: 1 }, { mode: 'crd', seed: -1 }, { mode: 'rcbd', seed: 1.5 }, { mode: 'crd', seed: 4294967296 }, { mode: 'crd', seed: NaN }]) assert.throws(() => allocateDesign(settings));
const damaged = structuredClone(crd); damaged.units[0].environment = 99; assert.throws(() => summarizeAllocation(damaged), /固定/);
const wrongProtocol = { ...crd, mode: 'rcbd' }; assert.throws(() => randomizationRCode(wrongProtocol), /RCBD/);

const temp = mkdtempSync(join(tmpdir(), 'cpsc440-randomization-'));
try {
  const script = cases.map((allocation, i) => `local({
invisible(capture.output({
${randomizationRCode(allocation)}
}))
# Independently check the realized allocation with base R counts and means.
ref_counts <- as.vector(t(with(d,table(treatment,block))))
ref_means <- as.numeric(aggregate(environment~treatment,data=d,mean)$environment)
cat("RANDREF",${i},paste(c(ref_counts,ref_means,rcbd_space,crd_space,balance_probability),collapse=","),sep="\t");cat("\n")
stopifnot(identical(as.character(d$id),sprintf("P%02d",1:15)))
})`).join('\n');
  const file = join(temp, 'reference.R'); writeFileSync(file, script);
  const output = execFileSync(process.env.RSCRIPT || 'Rscript', [file], { encoding: 'utf8', maxBuffer: 1e6 });
  const rows = output.split('\n').filter(line => line.startsWith('RANDREF\t')); assert.equal(rows.length, cases.length);
  rows.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(Number), summary = summarizeAllocation(cases[i]);
    const actual = [...summary.rows.flatMap(row => row.counts), ...summary.rows.map(row => row.meanEnvironment), 7776, 756756, designSpaces().balancedProbability];
    actual.forEach((value, j) => close(value, expected[j]));
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

class Element {
  constructor() { this.attrs = {}; this.events = {}; this.dataset = {}; this.classList = { add() {} }; this.value = ''; this.disabled = false; this._text = ''; this._html = ''; }
  set textContent(value) { this._text = String(value); }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); }
  get innerHTML() { return this._html; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  addEventListener(name, callback) { (this.events[name] ??= []).push(callback); }
  async dispatch(name) { if (name === 'click' && this.disabled) return; for (const callback of this.events[name] || []) await callback(); }
  focus() { document.activeElement = this; }
}
const previousDocument = globalThis.document, previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
let copied = '', failCopy = false, waitCopy = false, resolveCopy = null;
globalThis.document = { activeElement: null };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { if (failCopy) throw Error('denied'); copied = text; if (waitCopy) await new Promise(resolve => { resolveCopy = resolve; }); } } } });
try {
  const elements = {};
  for (const key of ['mode', 'seed', 'error', 'pending', 'applied', 'context', 'selection', 'balance', 'copy', 'code', 'copy-status']) elements[`[data-rnd-${key}]`] = new Element();
  for (const action of ['apply', 'next', 'balanced', 'reset']) elements[`[data-rnd-action="${action}"]`] = new Element();
  for (const unit of rcbd.units) for (const key of ['pot', 'label']) elements[`[data-rnd-${key}="${unit.id}"]`] = new Element();
  for (const t of ['A', 'B', 'C']) {
    for (let b = 0; b < 5; b++) elements[`[data-rnd-count="${t}-${b}"]`] = new Element();
    for (const key of ['total', 'environment']) elements[`[data-rnd-${key}="${t}"]`] = new Element();
  }
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-rnd-${key}]`], action = key => elements[`[data-rnd-action="${key}"]`];
  mountRandomization(root); mountRandomization(root);
  assert.equal(get('seed').events.input.length, 1); assert.equal(action('apply').events.click.length, 1);
  assert.match(get('applied').textContent, /RCBD.*seed=440/); assert.equal(get('code').textContent, randomizationRCode(rcbd));
  const pot = elements['[data-rnd-pot="P08"]']; pot.focus(); await pot.dispatch('click');
  assert.match(get('selection').textContent, /P08.*Block 3.*位置 2/); assert.equal(pot.attrs['aria-pressed'], 'true'); assert.equal(document.activeElement, pot);
  const appliedCode = get('code').textContent, oldLabels = rcbd.units.map(unit => elements[`[data-rnd-label="${unit.id}"]`].textContent);
  get('mode').value = 'crd'; await get('mode').dispatch('change'); get('seed').value = '26'; await get('seed').dispatch('input');
  assert.match(get('pending').textContent, /尚未应用.*RCBD.*440/); assert.match(get('applied').textContent, /RCBD.*440/);
  assert.equal(get('code').textContent, appliedCode); assert.deepEqual(rcbd.units.map(unit => elements[`[data-rnd-label="${unit.id}"]`].textContent), oldLabels);
  await get('copy').dispatch('click'); assert.equal(copied, appliedCode); assert.match(get('copy-status').textContent, /RCBD.*440/);
  await action('apply').dispatch('click'); assert.match(get('applied').textContent, /CRD.*seed=26/); assert.match(get('balance').textContent, /碰巧.*协议仍是 CRD/);
  assert.equal(get('code').textContent, randomizationRCode(selectedBalanced)); assert.equal(document.activeElement, pot); assert.equal(elements['[data-rnd-pot="P08"]'], pot);
  assert.match(get('selection').textContent, /P08.*Block 3.*位置 2/);
  const currentCode = get('code').textContent;
  for (const invalid of ['', '-1', '2.5', '4294967296', 'Infinity']) {
    get('seed').value = invalid; await get('seed').dispatch('input'); await action('apply').dispatch('click');
    assert.match(get('pending').textContent, /设置无效.*CRD.*26/); assert.equal(get('code').textContent, currentCode); assert.equal(get('copy').disabled, false); assert.equal(action('next').disabled, true);
    await get('copy').dispatch('click'); assert.equal(copied, currentCode);
  }
  await action('reset').dispatch('click'); assert.equal(get('mode').value, 'rcbd'); assert.equal(get('seed').value, '440'); assert.equal(get('code').textContent, appliedCode); assert.match(get('selection').textContent, /P01/);
  get('seed').value = '4294967295'; await get('seed').dispatch('input'); assert.equal(action('next').disabled, true); await action('apply').dispatch('click'); assert.match(get('applied').textContent, /4294967295/);
  await action('reset').dispatch('click'); await action('next').dispatch('click'); assert.equal(get('seed').value, '441'); assert.match(get('applied').textContent, /seed=441/);
  await action('balanced').dispatch('click'); assert.equal(get('mode').value, 'crd'); assert.equal(get('seed').value, '26'); assert.match(get('context').textContent, /预先挑出.*不能.*估计/);
  failCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中/); failCopy = false;
  waitCopy = true; const pendingCopy = get('copy').dispatch('click'); await action('reset').dispatch('click'); resolveCopy(); await pendingCopy; waitCopy = false; assert.equal(get('copy-status').textContent, '');
  get('mode').value = 'crd'; get('seed').value = '70'; await action('apply').dispatch('click');
  assert.match(get('balance').textContent, /重复.*缺少/); for (const t of ['A', 'B', 'C']) assert.equal(elements[`[data-rnd-environment="${t}"]`].textContent, '0');
  assert.match(root.innerHTML, /平均值相同本身不保证/); assert.match(root.innerHTML, /不是检验 P 值/); assert.match(root.innerHTML, /没有物理单位/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log('Randomization: independently enumerated 756756 CRD and 7776 RCBD assignments, deterministic shuffle and structural invariants, R allocation checks, common-environment counterexample, stable pot controls, draft/applied separation, invalid/reset and copy lifecycle passed.');
