import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { binomialAnalysis, binomialRCode, binomialGeometry, drawBinomial, mountBinomial, chapterProbabilityLabel, binomialDefaults } from '../assets/binomial.mjs';

const modes = ['point', 'left', 'right', 'two'];
const relative = (actual, expected, context) => {
  assert.ok(Number.isFinite(actual), context);
  if (expected === 0) assert.equal(actual, 0, context);
  else assert.ok(Math.abs(actual / expected - 1) < 1e-10, `${context}: ${actual} vs ${expected}`);
};

// Independent dbinom/pbinom/binom.test references, including the complete
// probability-ordered count set, not just a rounded final P-value.
const rScript = `for (n in c(1,2,5,16,20,59,60)) for (p0 in c(0,.01,.2,.3,.5,.85,.99,1)) for (x in 0:min(60,n+1)) {
  counts <- 0:n
  pmf <- dbinom(counts,n,p0)
  included <- if(x<=n) pmf<=dbinom(x,n,p0)*(1+1e-7) else rep(FALSE,n+1)
  values <- c(n,p0,x,dbinom(x,n,p0),pbinom(x,n,p0),pbinom(x-1,n,p0,lower.tail=FALSE),
              if(x<=n) binom.test(x,n,p=p0)$p.value else NA_real_,
              sum(pmf[counts!=x]),pbinom(x,n,p0,lower.tail=FALSE),pbinom(x-1,n,p0),
              if(x<=n) sum(pmf[!included]) else NA_real_)
  cat(paste(sprintf("%.17g",values),collapse="|"),paste(counts[included],collapse=","),
      paste(sprintf("%.17g",pmf),collapse=","),sep="|");cat("\n")
}`;
const references = execFileSync(process.env.RSCRIPT || 'Rscript', ['--vanilla', '-'], { input: rScript, encoding: 'utf8', maxBuffer: 8e6 }).trim().split('\n');
let comparisons = 0, geometryStates = 0;
for (const line of references) {
  const fields = line.split('|'), numbers = fields.slice(0, 11).map(Number), [n, p, k] = numbers;
  const included = fields[11] ? fields[11].split(',').map(Number) : [];
  const referencePMF = fields[12].split(',').map(Number);
  for (const [index, mode] of modes.entries()) {
    if (mode === 'two' && k > n) { assert.throws(() => binomialAnalysis({ n, p, k, mode }), /x.*>n/); continue; }
    const r = binomialAnalysis({ n, p, k, mode });
    relative(r.probability, numbers[3 + index], `n=${n} p=${p} k=${k} ${mode}`);
    relative(r.complement, numbers[7 + index], `complement n=${n} p=${p} k=${k} ${mode}`);
    r.pmf.forEach((value, j) => relative(value, referencePMF[j], `PMF n=${n} p=${p} j=${j}`));
    const expectedSet = mode === 'two' ? included : Array.from({ length: n + 1 }, (_, j) => j).filter(j => mode === 'point' ? j === k : mode === 'left' ? j <= k : j >= k);
    assert.deepEqual(r.included, expectedSet);
    assert.equal(r.included.length + r.excluded.length, n + 1);
    assert.equal(new Set([...r.included, ...r.excluded]).size, n + 1);
    assert.ok(Math.abs(r.probability + r.complement - 1) < 1e-11);
    if (k > n) assert.equal(r.comparisons.two, null);
    comparisons++;
  }
}
assert.ok(references.length > 1300);
for (let n = 1; n <= 60; n++) for (const p of [0, .01, .2, .5, .99, 1]) for (const k of [...new Set([0, Math.floor(n / 2), n, Math.min(60, n + 1)])]) for (const mode of modes) {
  if (mode === 'two' && k > n) continue;
  const r = binomialAnalysis({ n, p, k, mode }), g = binomialGeometry(r);
  assert.equal(g.bars.length, n + 1);
  for (const bar of g.bars) {
    for (const value of [bar.x, bar.y, bar.width, bar.height]) assert.ok(Number.isFinite(value));
    assert.ok(bar.width > 0 && bar.height >= 0);
    assert.ok(bar.x > g.left && bar.x + bar.width < g.right);
    assert.ok(bar.y >= g.top && bar.y + bar.height <= g.bottom + 1e-10);
    assert.equal(bar.observed, bar.j === k); assert.equal(bar.included, r.included.includes(bar.j));
    relative(bar.height / (g.bottom - g.top), bar.probability / g.maximum, 'Bar height represents PMF');
  }
  if (k <= n) { assert.equal(g.observed.y, g.bars[k].y); assert.ok(Math.abs(g.observed.x - (g.bars[k].x + g.bars[k].width / 2)) < 1e-10); }
  else assert.equal(g.observed, null);
  geometryStates++;
}

const asym = binomialAnalysis({ n: 20, p: .2, k: 0, mode: 'two' });
assert.deepEqual(asym.included, [0, ...Array.from({ length: 12 }, (_, j) => j + 9)]);
relative(asym.probability, .02151100136679279, 'Asymmetric lesson example');
assert.ok(Math.abs(asym.probability - 2 * asym.comparisons.left.probability) > .001);
const exercise = binomialAnalysis({ n: 16, p: .3, k: 1, mode: 'two' });
assert.deepEqual(exercise.included, [0, 1, 9, 10, 11, 12, 13, 14, 15, 16]);
relative(exercise.probability, .051785118359659, 'p04-12');
const middle = binomialAnalysis({ n: 20, p: .5, k: 10, mode: 'two' });
assert.equal(middle.probability, 1); assert.equal(middle.complement, 0);
assert.ok(middle.comparisons.point.probability < .2);
assert.equal(chapterProbabilityLabel(binomialAnalysis({ n: 60, p: .01, k: 60 }).probability), '1.000e-120');
const nearOne = binomialAnalysis({ n: 60, p: .99, k: 1 });
assert.equal(chapterProbabilityLabel(nearOne.probability, nearOne.complement), '1 − 1.000e-120');
assert.equal(chapterProbabilityLabel(0, 1), '0'); assert.equal(chapterProbabilityLabel(1, 0), '1');
for (const bad of [{ n: 0 }, { n: 61 }, { n: 1.1 }, { n: '20' }, { n: NaN }, { p: -1 }, { p: 1.01 }, { p: Infinity }, { p: '0.2' }, { k: -1 }, { k: 61 }, { k: .5 }, { k: NaN }, { mode: 'unknown' }]) assert.throws(() => binomialAnalysis({ ...binomialDefaults, ...bad }));
assert.throws(() => binomialRCode({ n: 2, p: .5, k: 3, mode: 'two' }));

// Execute the copyable code itself for all four modes, including the supported
// k>n probability questions and genuine zero-probability boundary models.
const exported = [];
for (const settings of [{ n: 20, p: .2, k: 0 }, { n: 16, p: .3, k: 1 }, { n: 20, p: .5, k: 10 }, { n: 60, p: .01, k: 60 }, { n: 60, p: .99, k: 1 }, { n: 4, p: 0, k: 2 }, { n: 4, p: 1, k: 4 }, { n: 4, p: .4, k: 7 }]) for (const mode of modes) {
  if (mode === 'two' && settings.k > settings.n) continue;
  const script = binomialRCode({ ...settings, mode });
  assert.ok(script.split('\n').filter(line => line.trimStart().startsWith('#')).every(line => !/[\u3400-\u9fff]/.test(line)));
  exported.push(`local({\n${script}\n})`);
}
execFileSync(process.env.RSCRIPT || 'Rscript', ['--vanilla', '-'], { input: exported.join('\n'), encoding: 'utf8', maxBuffer: 2e6 });

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.classList = { add() {} }; this.value = ''; this.disabled = false; this._text = ''; this._html = ''; }
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
const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'), savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const clipboard = [];
try {
  Object.defineProperty(globalThis, 'document', { value: { activeElement: null, createElementNS: (namespace, name) => new Element(name) }, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async text => { clipboard.push(text); } } }, configurable: true });
  const controls = Object.fromEntries(Object.entries({ bn: 20, bp: .85, bk: 18 }).map(([id, value]) => [`#${id}`, Object.assign(new Element('input'), { value: String(value) })]));
  for (const id of ['bn', 'bp', 'bk']) controls[`#${id}-v`] = new Element('output');
  for (const key of ['mode', 'preset', 'reset', 'error', 'result', 'plot', 'zoom-plot', 'comparisons', 'rule', 'rows', 'copy', 'code', 'copy-status']) controls[`[data-binom-${key}]`] = new Element(key.includes('plot') ? 'svg' : 'div');
  const get = key => controls[`[data-binom-${key}]`]; get('mode').value = 'right';
  const root = new Element(); root.querySelector = selector => controls[selector] || null;
  mountBinomial(root); mountBinomial(root);
  assert.equal(get('mode').events.input.length, 1);
  assert.equal(controls['#bn'].events.input.length, 1);
  const originalMarkup = root.innerHTML, originalControls = { ...controls };
  assert.match(get('result').innerHTML, /P\(X≥18\) = 0.404896/);
  assert.equal(get('plot').children.filter(node => node.tag === 'rect').length, 21);
  const barMarkup = () => get('plot').children.filter(node => node.tag === 'rect');
  assert.deepEqual(barMarkup().filter(node => node.attrs['data-binom-included'] === 'true').map(node => +node.attrs['data-binom-j']), [18, 19, 20]);
  assert.equal(JSON.stringify(get('plot').children), JSON.stringify(get('zoom-plot').children));
  get('mode').focus(); get('mode').value = 'left'; await get('mode').dispatch('change');
  assert.equal(document.activeElement, get('mode'));
  assert.deepEqual(barMarkup().filter(node => node.attrs['data-binom-included'] === 'true').map(node => +node.attrs['data-binom-j']), Array.from({ length: 19 }, (_, j) => j));
  await get('preset').dispatch('click');
  assert.deepEqual(['#bn', '#bp', '#bk'].map(key => controls[key].value), ['20', '0.2', '0']);
  assert.equal(get('mode').value, 'two'); assert.match(get('result').innerHTML, /0.021511/);
  assert.deepEqual(barMarkup().filter(node => node.attrs['data-binom-included'] === 'true').map(node => +node.attrs['data-binom-j']), asym.included);
  assert.equal(get('rows').innerHTML.match(/<tr/g).length, 21);
  assert.match(get('rule').textContent, /1e−7.*相对容差.*不是给概率加/);
  await get('copy').dispatch('click'); assert.equal(clipboard.at(-1), binomialRCode(asym));
  assert.match(get('copy-status').textContent, /已复制当前设置/);
  controls['#bk'].value = '21'; await controls['#bk'].dispatch('input');
  assert.equal(controls['#bk'].value, '21'); assert.match(get('error').textContent, /x=21>n=20/);
  assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, '');
  assert.equal(get('plot').children.length, 0); assert.equal(get('rows').innerHTML, '');
  const previousCopies = clipboard.length; await get('copy').dispatch('click'); assert.equal(clipboard.length, previousCopies);
  get('mode').value = 'left'; await get('mode').dispatch('input');
  assert.equal(get('error').textContent, ''); assert.match(get('result').innerHTML, /P\(X≤21\) = 1/);
  assert.match(get('comparisons').innerHTML, /不适用：x>n/); assert.equal(get('copy').disabled, false);
  assert.equal(get('plot').children.filter(node => node.tag === 'circle').length, 0);
  get('mode').value = 'two'; await get('mode').dispatch('input');
  controls['#bn'].value = '21'; await controls['#bn'].dispatch('input');
  assert.equal(get('error').textContent, ''); assert.equal(get('copy').disabled, false);
  for (const [key, value] of [['#bn', ''], ['#bk', '1.5'], ['#bp', 'NaN'], ['#bn', '61']]) {
    await get('reset').dispatch('click'); controls[key].value = value; await controls[key].dispatch('input');
    assert.notEqual(get('error').textContent, ''); assert.equal(get('copy').disabled, true); assert.equal(get('plot').children.length, 0);
  }
  await get('reset').dispatch('click'); assert.match(get('result').innerHTML, /P\(X≥18\) = 0.404896/);
  let resolveCopy;
  navigator.clipboard.writeText = text => { clipboard.push(text); return new Promise(resolve => { resolveCopy = resolve; }); };
  const copying = get('copy').dispatch('click');
  await get('preset').dispatch('click'); resolveCopy(); await copying;
  assert.match(get('copy-status').textContent, /点击时的设置.*重新复制/);
  navigator.clipboard.writeText = async () => { throw Error('clipboard unavailable'); };
  await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中上方完整代码复制/);
  assert.equal(root.innerHTML, originalMarkup);
  for (const [key, node] of Object.entries(originalControls)) assert.equal(controls[key], node);
  const svg = new Element('svg'); drawBinomial(svg, asym);
  assert.ok(svg.children.every(node => Object.values(node.attrs).every(value => !/NaN|Infinity/.test(value))));
  assert.equal(svg.children.filter(node => node.tag === 'circle')[0].attrs.cy, String(binomialGeometry(asym).bars[0].y));
} finally {
  if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument); else delete globalThis.document;
  if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator); else delete globalThis.navigator;
}
console.log(`Binomial: ${comparisons} independent R event/count-set comparisons, ${geometryStates} geometry states, ${exported.length} executable R exports, boundaries and stable-control/copy lifecycle passed.`);
