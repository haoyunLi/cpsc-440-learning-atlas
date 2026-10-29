import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { diagnosticData, diagnosticModes, diagnosticsRCode, diagnosticGeometry, drawDiagnostics, mountDiagnostics } from '../assets/diagnostics.mjs';
import { mountWorkbench } from '../assets/workbench.mjs';

const near = (a, b, tolerance = 1e-10) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} versus ${b}`);
const datasets = diagnosticModes.map(diagnosticData);
// Independent integer arithmetic reproduces the original seed-440 raw draws.
for (const data of datasets) {
  let seed = 440n;
  const uniform = () => { seed = (1664525n * seed + 1013904223n) % 4294967296n; return (Number(seed) + .5) / 4294967296; };
  data.points.forEach((point, index) => {
    const group = Math.floor(index / 16), z = Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
    const error = data.mode === 'skew' ? Math.exp(z * .9) - Math.exp(.405) : z * (data.mode === 'unequal' ? [.45, 1, 2.8][group] : 1);
    assert.equal(point.value, [10, 13, 16][group] + error + (data.mode === 'outlier' && index === 47 ? 12 : 0));
    assert.equal(point.id, `G${group + 1}-${String(index % 16 + 1).padStart(2, '0')}`);
    assert.equal(point.index, index);
    near(point.value - point.fitted, point.residual, 0);
  });
  assert.deepEqual(data, diagnosticData(data.mode));
  assert.equal(new Set(data.points.map(point => point.id)).size, 48);
  assert.deepEqual([...data.points].sort((a, b) => a.residual - b.residual || a.index - b.index).map(point => point.id), data.ordered.map(point => point.id));
  assert.deepEqual(data.ordered.map(point => point.order), Array.from({ length: 48 }, (_, i) => i + 1));
  data.ordered.forEach((point, i) => { assert.equal(point.probability, (i + .5) / 48); assert.equal(point.residual, data.sorted[i]); });
  for (let group = 0; group < 3; group++) near(data.points.filter(point => point.group === group).reduce((sum, point) => sum + point.residual, 0), 0, 1e-11);
}
assert.throws(() => diagnosticData('unknown'));
const original = datasets[0], outlier = datasets[2];
for (let i = 0; i < 48; i++) {
  near(outlier.points[i].value - original.points[i].value, i === 47 ? 12 : 0);
  near(outlier.points[i].fitted - original.points[i].fitted, i >= 32 ? .75 : 0);
  near(outlier.points[i].residual - original.points[i].residual, i === 47 ? 11.25 : i >= 32 ? -.75 : 0);
}
assert.equal(original.ordered[0].id, 'G2-11'); assert.notEqual(original.points[0].id, original.ordered[0].id);
assert.equal(outlier.ordered.at(-1).id, 'G3-16');

const rReference = datasets.map(data => `local({
  y <- c(${data.points.map(point => point.value).join(',')})
  group <- factor(rep(1:3,each=16))
  model <- lm(y~group)
  fitted <- fitted(model); e <- residuals(model)
  ord <- order(e,seq_along(e)); positions <- order(ord)
  probabilities <- ppoints(length(e))[positions]
  theoretical <- qnorm(probabilities)
  for(i in seq_along(e)) {
    cat("ROW", "${data.mode}", i, paste(sprintf("%.17g",c(y[i],fitted[i],e[i],positions[i],probabilities[i],theoretical[i])),collapse=","),sep="|");cat("\n")
  }
  sq <- quantile(e,c(.25,.75),type=7,names=FALSE); tq <- qnorm(c(.25,.75))
  slope <- diff(sq)/diff(tq); intercept <- sq[1]-slope*tq[1]
  cat("LINE", "${data.mode}", paste(sprintf("%.17g",c(intercept,slope)),collapse=","),sep="|");cat("\n")
})`).join('\n');
const output = execFileSync(process.env.RSCRIPT || 'Rscript', ['--vanilla', '-'], { input: rReference, encoding: 'utf8' }).trim().split('\n');
assert.equal(output.filter(line => line.startsWith('ROW|')).length, 192);
let largestQuantileError = 0;
for (const line of output) {
  const [type, mode, index, vector] = line.split('|'), data = datasets.find(item => item.mode === mode);
  if (type === 'ROW') {
    const values = vector.split(',').map(Number), point = data.points[Number(index) - 1];
    [point.value, point.fitted, point.residual, point.order, point.probability].forEach((value, j) => near(value, values[j]));
    // The existing shared normal quantile inverts an approximate normal CDF.
    // This tolerance bounds that approximation; raw data and residuals use 1e-10.
    near(point.theoretical, values[5], 3e-6);
    largestQuantileError = Math.max(largestQuantileError, Math.abs(point.theoretical - values[5]));
  } else {
    const [intercept, slope] = index.split(',').map(Number);
    near(data.intercept, intercept, 1e-10); near(data.slope, slope, 3e-6);
  }
}
const exported = datasets.flatMap(data => [[data.points[0].id, 1], [data.points[47].id, 48]].map(([id, count]) => diagnosticsRCode(data, id, count)));
for (const code of exported) assert.ok(code.split('\n').filter(line => line.trimStart().startsWith('#')).every(line => !/[\u3400-\u9fff]/.test(line)));
execFileSync(process.env.RSCRIPT || 'Rscript', ['--vanilla', '-'], { input: `pdf(file=NULL)\n${exported.map(code => `local({\n${code}\n})`).join('\n')}\ndev.off()`, encoding: 'utf8', maxBuffer: 2e6 });
assert.throws(() => diagnosticsRCode(original, 'G9-01'));
assert.throws(() => diagnosticsRCode(original, 'G1-01', 0));

class Element {
  constructor(tag = 'div') { this.tag = tag; this.attrs = {}; this.children = []; this.events = {}; this.dataset = {}; this.classes = new Set(); this.classList = { add: name => this.classes.add(name), toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) }; this.value = ''; this.disabled = false; this._text = ''; this._html = ''; }
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
const saved = Object.fromEntries(['document', 'window', 'navigator', 'setInterval', 'clearInterval'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const documentEvents = {}, windowEvents = {}, timers = new Map(), clipboard = [];
let timerId = 0, observed, root;
const motion = { matches: false, addEventListener(name, callback) { this[name] = callback; } };
try {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false, activeElement: null, createElementNS: (ns, name) => new Element(name), addEventListener(name, callback) { documentEvents[name] = callback; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => motion, addEventListener(name, callback) { windowEvents[name] = callback; }, IntersectionObserver: class { constructor(callback) { observed = callback; } observe(target) { assert.equal(target, root); } } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { clipboard.push(text); } } } });
  globalThis.setInterval = callback => { timers.set(++timerId, callback); return timerId; };
  globalThis.clearInterval = id => timers.delete(id);
  const svg = new Element('svg');
  for (const data of datasets) for (let count = 1; count <= 48; count++) {
    const selected = data.points[count - 1];
    const idSets = [], selectedHeights = [];
    for (const type of ['residual', 'qq']) {
      drawDiagnostics(svg, data, type, count, selected.id);
      const g = diagnosticGeometry(data, type), points = svg.children.filter(node => 'data-diag-id' in node.attrs);
      assert.equal(points.length, count); idSets.push(points.map(node => node.attrs['data-diag-id']));
      for (const point of points) {
        const model = data.points.find(item => item.id === point.attrs['data-diag-id']);
        near(+point.attrs.cx, g.x(type === 'residual' ? model.fitted : model.theoretical));
        near(+point.attrs.cy, g.y(model.residual));
        assert.ok(+point.attrs.cx - +point.attrs.r > 86 && +point.attrs.cx + +point.attrs.r < 618);
        assert.ok(+point.attrs.cy - +point.attrs.r > 53 && +point.attrs.cy + +point.attrs.r < 267);
      }
      const ring = svg.children.find(node => 'data-diag-selected' in node.attrs); assert.ok(ring);
      selectedHeights.push(+ring.attrs.cy);
      assert.ok(+ring.attrs.cx - 10 > 86 && +ring.attrs.cx + 10 < 618);
      assert.ok(+ring.attrs.cy - 10 > 53 && +ring.attrs.cy + 10 < 267);
      assert.ok(svg.children.every(node => Object.values(node.attrs).every(value => !/NaN|Infinity/.test(value))));
      assert.match(svg.attrs['aria-label'], new RegExp(selected.id));
    }
    assert.deepEqual(idSets[0], idSets[1]); assert.equal(selectedHeights[0], selectedHeights[1]);
  }
  const nodes = {}, buttons = [];
  for (const key of ['mode', 'point', 'error', 'progress', 'selected', 'narrative', 'copy', 'code', 'copy-status']) nodes[`[data-diag-${key}]`] = new Element();
  for (const type of ['residual', 'qq']) for (const key of ['plot', 'zoom']) nodes[`[data-diag-${key}="${type}"]`] = new Element('svg');
  for (const key of ['step', 'play', 'all']) nodes[`[data-action="${key}"]`] = new Element('button');
  for (const point of original.points) {
    nodes[`[data-diag-row="${point.id}"]`] = new Element('tr');
    for (const key of ['value', 'fitted', 'residual', 'order', 'probability', 'theoretical', 'shown']) nodes[`[data-diag-cell="${point.id}:${key}"]`] = new Element('td');
    const button = new Element('button'); button.value = point.id; buttons.push(button);
  }
  const get = key => nodes[`[data-diag-${key}]`], action = key => nodes[`[data-action="${key}"]`], plot = type => nodes[`[data-diag-plot="${type}"]`];
  get('mode').value = 'normal'; get('point').value = 'G1-01';
  root = new Element(); root.dataset.workbench = 'diagnostics';
  root.querySelector = selector => nodes[selector] || null;
  root.querySelectorAll = selector => selector === '[data-diag-select]' ? buttons : [];
  // Verify the public workbench route delegates to the new module, once.
  mountWorkbench(root); mountWorkbench(root); mountDiagnostics(root);
  assert.equal(get('mode').events.input.length, 1); assert.equal(buttons[0].events.click.length, 1);
  const rootMarkup = root.innerHTML, originalNodes = { ...nodes };
  assert.match(rootMarkup, /不是连续 x 的曲率诊断/);
  assert.match(rootMarkup, /相同 residual 按原始 ID 顺序排列，不使用 average rank/);
  assert.match(get('progress').textContent, /48 \/ 48/);
  const visibleIds = type => plot(type).children.filter(node => 'data-diag-id' in node.attrs).map(node => node.attrs['data-diag-id']);
  const check = count => {
    assert.equal(visibleIds('residual').length, count); assert.deepEqual(visibleIds('residual'), visibleIds('qq'));
    assert.equal(JSON.stringify(plot('residual').children), JSON.stringify(nodes['[data-diag-zoom="residual"]'].children));
    assert.equal(JSON.stringify(plot('qq').children), JSON.stringify(nodes['[data-diag-zoom="qq"]'].children));
  };
  const tick = () => [...timers.values()].forEach(callback => callback());
  const stopped = () => { assert.equal(timers.size, 0); assert.equal(action('play').attrs['aria-pressed'], 'false'); };
  for (const data of datasets) {
    get('mode').value = data.mode; await get('mode').dispatch('input'); check(48);
    await action('step').dispatch('click'); check(1);
    assert.deepEqual(visibleIds('qq'), ['G1-01']);
    assert.match(get('selected').innerHTML, new RegExp(`i=${data.points[0].order}`));
    await action('play').dispatch('click'); assert.equal(timers.size, 1);
    for (let count = 2; count <= 48; count++) { tick(); check(count); assert.equal(get('point').value, data.points[count - 1].id); }
    stopped(); assert.equal(get('point').value, 'G3-16');
  }
  buttons[26].focus(); await buttons[26].dispatch('click');
  assert.equal(document.activeElement, buttons[26]); assert.equal(get('point').value, 'G2-11'); check(48);
  assert.equal(buttons[26].attrs['aria-pressed'], 'true'); assert.ok(nodes['[data-diag-row="G2-11"]'].classes.has('diag-current'));
  get('point').focus(); get('point').value = 'G3-16'; await get('point').dispatch('change');
  assert.equal(document.activeElement, get('point')); assert.equal(buttons[47].attrs['aria-pressed'], 'true');
  get('mode').value = 'outlier'; await get('mode').dispatch('change');
  assert.equal(get('point').value, 'G3-16'); assert.match(get('selected').innerHTML, /10.17862/); assert.match(get('narrative').textContent, /12\/16=.75.*11.25/);
  assert.equal(nodes['[data-diag-cell="G3-16:order"]'].textContent, '48');
  await get('copy').dispatch('click'); assert.equal(clipboard.at(-1), diagnosticsRCode(outlier, 'G3-16', 48));
  get('point').value = 'invalid'; await get('point').dispatch('change'); assert.equal(get('point').value, 'G3-16');
  await action('play').dispatch('click'); tick(); await action('play').dispatch('click'); stopped(); check(2);
  await action('play').dispatch('click'); get('mode').value = 'normal'; await get('mode').dispatch('input'); stopped(); check(48);
  await action('play').dispatch('click'); await buttons[7].dispatch('click'); stopped(); check(48); assert.equal(get('point').value, 'G1-08');
  await action('play').dispatch('click'); motion.matches = true; motion.change(); stopped(); assert.equal(action('play').disabled, true);
  await action('play').dispatch('click'); stopped(); await action('step').dispatch('click'); check(2);
  motion.matches = false; motion.change(); assert.equal(action('play').disabled, false);
  await action('play').dispatch('click'); document.hidden = true; documentEvents.visibilitychange(); stopped(); document.hidden = false;
  await action('play').dispatch('click'); observed([{ isIntersecting: false }]); stopped();
  await action('play').dispatch('click'); windowEvents.pagehide(); stopped();
  await action('all').dispatch('click'); check(48);
  get('mode').value = 'invalid'; await get('mode').dispatch('input');
  assert.match(get('error').textContent, /未知/); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, '');
  assert.equal(plot('residual').children.length, 0); assert.equal(plot('qq').children.length, 0); assert.equal(action('play').disabled, true);
  get('mode').value = 'normal'; await get('mode').dispatch('input'); check(48); assert.equal(get('copy').disabled, false);
  let resolveCopy; navigator.clipboard.writeText = text => { clipboard.push(text); return new Promise(resolve => { resolveCopy = resolve; }); };
  const pending = get('copy').dispatch('click'); await action('step').dispatch('click'); resolveCopy(); await pending;
  assert.match(get('copy-status').textContent, /点击时的数据与 ID.*重新复制/);
  navigator.clipboard.writeText = async () => { throw Error('denied'); };
  await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中上方完整代码复制/);
  assert.equal(root.innerHTML, rootMarkup);
  for (const [selector, node] of Object.entries(originalNodes)) assert.equal(nodes[selector], node);
} finally {
  for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
}
console.log(`Diagnostics: 192 independent R rows and 4 qqline references (max q error ${largestQuantileError.toExponential(2)}), 8 executable R exports, 384 full/partial plot states, same-ID tracking, stable table/control nodes and animation/copy lifecycle passed.`);
