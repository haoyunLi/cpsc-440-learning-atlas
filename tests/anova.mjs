import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { anovaAnalysis, anovaRCode, drawAnova, drawAnovaDecomposition, mountAnova } from '../assets/anova.mjs';

const close = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)), `${a} versus ${b}`);
const ids = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
const settings = Array.from({ length: 25 }, (_, gi) => Array.from({ length: 20 }, (_, ni) => ({ gap: gi / 4, noise: (ni + 1) / 4 }))).flat();
const exportCases = [...ids.map(id => ({ gap: 3, noise: 1, id })), ...[{ gap: 0, noise: .25 }, { gap: 0, noise: 5 }, { gap: 6, noise: .25 }, { gap: 6, noise: 5 }, { gap: 3.25, noise: 2.75 }].map(s => ({ ...s, id: 'C3' }))];
const temp = mkdtempSync(join(tmpdir(), 'cpsc440-anova-'));
try {
  const blocks = settings.map(({ gap, noise }, i) => `local({
y_ref <- c(5+${noise}*c(-1,0,1),5+${gap}+${noise}*c(-1,0,1),5+2*${gap}+${noise}*c(-1,0,1))
g_ref <- factor(rep(c("A","B","C"),each=3))
fit_ref <- lm(y_ref~g_ref)
table_ref <- anova(fit_ref)
grand_ref <- mean(y_ref)
means_ref <- as.numeric(tapply(y_ref,g_ref,mean))
total_ref <- y_ref-grand_ref
between_ref <- fitted(fit_ref)-grand_ref
residual_ref <- residuals(fit_ref)
values_ref <- c(grand_ref,means_ref,sum(total_ref^2),table_ref[1,"Sum Sq"],table_ref[2,"Sum Sq"],
               table_ref[1,"Mean Sq"],table_ref[2,"Mean Sq"],table_ref[1,"F value"],table_ref[1,"Pr(>F)"],
               as.vector(t(cbind(y_ref,total_ref,between_ref,residual_ref,
                 total_ref^2,between_ref^2,residual_ref^2,2*between_ref*residual_ref))))
cat("ANOVAREF",${i},paste(sprintf("%.17g",values_ref),collapse=","),sep="\t");cat("\n")
})`);
  blocks.push(...exportCases.map(({ gap, noise, id }) => `local({
invisible(capture.output({
${anovaRCode({ gap, noise }, id)}
}))
expected <- c(5+${noise}*c(-1,0,1),5+${gap}+${noise}*c(-1,0,1),5+2*${gap}+${noise}*c(-1,0,1))
stopifnot(identical(d$y,expected),identical(d$id,c("A1","A2","A3","B1","B2","B3","C1","C2","C3")),
          identical(selected_id,"${id}"),N==9,k==3,df_between==2,df_error==6,
          abs(SStrt-6*${gap}^2)<1e-12,abs(SSE-6*${noise}^2)<1e-12,
          abs(p_value-pf(3*${gap}^2/${noise}^2,2,6,lower.tail=FALSE))<1e-12)
})`));
  const path = join(temp, 'reference.R'); writeFileSync(path, blocks.join('\n'));
  const stdout = execFileSync(process.env.RSCRIPT || 'Rscript', [path], { encoding: 'utf8', maxBuffer: 2e6 });
  const lines = stdout.split('\n').filter(line => line.startsWith('ANOVAREF\t')); assert.equal(lines.length, settings.length);
  lines.forEach((line, i) => {
    const expected = line.split('\t')[2].split(',').map(Number), r = anovaAnalysis(settings[i]);
    const actual = [r.grandMean, ...r.groups.map(group => group.mean), r.sst, r.ssb, r.sse, r.msBetween, r.mse, r.f, r.p,
      ...r.rows.flatMap(row => [row.value, row.total, row.between, row.residual, row.totalSquare, row.betweenSquare, row.residualSquare, row.cross])];
    assert.equal(actual.length, expected.length); actual.forEach((value, j) => close(value, expected[j]));
    // Relative tolerance preserves the tiny, positive F tail at the largest
    // legal F; absolute-only tests could silently accept a displayed zero.
    close(r.p / expected[10], 1);
  });
} finally { rmSync(temp, { recursive: true, force: true }); }

const initial = anovaAnalysis();
assert.deepEqual(initial.rows.map(row => row.value), [4, 5, 6, 7, 8, 9, 10, 11, 12]);
assert.deepEqual([initial.grandMean, initial.sst, initial.ssb, initial.sse, initial.msBetween, initial.mse, initial.f], [8, 60, 54, 6, 27, 1, 27]);
close(initial.p, .001); assert.deepEqual(initial.rows.slice(0, 3).map(row => row.cross), [6, 0, -6]);
assert.deepEqual([initial.rows[0].totalSquare, initial.rows[0].betweenSquare, initial.rows[0].residualSquare, initial.rows[0].cross], [16, 9, 1, 6]);
assert.deepEqual([initial.rows[2].totalSquare, initial.rows[2].betweenSquare, initial.rows[2].residualSquare, initial.rows[2].cross], [4, 9, 1, -6]);
for (const setting of settings) {
  const r = anovaAnalysis(setting); assert.deepEqual(r.rows.map(row => row.id), ids);
  assert.equal(r.N, 9); assert.equal(r.k, 3); assert.deepEqual([r.dfBetween, r.dfError, r.dfTotal], [2, 6, 8]);
  assert.equal(r.ssb, 6 * setting.gap ** 2); assert.equal(r.sse, 6 * setting.noise ** 2);
  assert.equal(r.sst, r.ssb + r.sse); assert.equal(r.crossSum, 0); close(r.f, 3 * setting.gap ** 2 / setting.noise ** 2);
  close(r.p / ((1 + r.f / 3) ** -3), 1); // Independent closed form for F(2,6) survival.
  assert.equal(r.grandMean, r.groups.reduce((sum, group) => sum + group.n * group.mean, 0) / r.N);
  for (const row of r.rows) {
    assert.equal(row.total, row.between + row.residual);
    assert.equal(row.totalSquare, row.betweenSquare + row.residualSquare + row.cross);
  }
  for (const group of r.groups) { assert.equal(group.n, 3); assert.equal(group.residualSum, 0); assert.equal(group.crossSum, 0); }
  if (setting.gap === 0) { assert.equal(r.f, 0); assert.equal(r.p, 1); assert.equal(r.ssb, 0); assert.ok(r.mse > 0); }
}
for (const gap of [0, .25, 3, 6]) {
  const left = anovaAnalysis({ gap, noise: 1 }), right = anovaAnalysis({ gap, noise: 2 });
  assert.equal(left.ssb, right.ssb); assert.equal(right.sse, left.sse * 4); close(right.f, left.f / 4);
}
for (const noise of [.25, 1, 5]) {
  const left = anovaAnalysis({ gap: 1, noise }), right = anovaAnalysis({ gap: 2, noise });
  assert.equal(left.sse, right.sse); assert.equal(right.ssb, left.ssb * 4); close(right.f, left.f * 4);
}
const changed = anovaAnalysis(); changed.rows[0].value = 99; changed.groups[0].n = 99; assert.deepEqual(anovaAnalysis(), initial);
for (const gap of [-.25, 6.25, .1, NaN, Infinity, '3', null]) assert.throws(() => anovaAnalysis({ gap }));
for (const noise of [0, -.25, 5.25, .1, NaN, Infinity, '1', null]) assert.throws(() => anovaAnalysis({ noise }));
for (const id of ['', 'A4', 'D1', null, 1]) assert.throws(() => anovaRCode({}, id));

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
  const plot = new Element('svg'), decomposition = new Element('svg');
  // All 25 × 20 allowed slider states, each of the nine selectable IDs.
  // Verify actual generated SVG endpoints, not only the analysis equations.
  for (const setting of settings) {
    const r = anovaAnalysis(setting);
    for (const id of ids) {
      drawAnova(plot, r, id); drawAnovaDecomposition(decomposition, r, id);
      const row = r.rows.find(item => item.id === id), points = plot.children.filter(el => 'data-anov-point' in el.attrs);
      assert.equal(points.length, 9); assert.equal(points.filter(el => el.attrs['data-selected'] === 'true').length, 1);
      assert.deepEqual(points.map(el => el.attrs['data-anov-point']), ids);
      for (const point of points) {
        const source = r.rows.find(item => item.id === point.attrs['data-anov-point']), x = Number(point.attrs.cx), y = Number(point.attrs.cy), radius = Number(point.attrs.r);
        close(y, 292 - (source.value + 2) / 26 * 240); assert.ok(x - radius > 80 && x + radius < 625 && y - radius > 52 && y + radius < 292);
      }
      const parts = [['total', r.grandMean, row.value], ['between', r.grandMean, row.groupMean], ['residual', row.groupMean, row.value]];
      for (const [key, start, end] of parts) {
        const line = decomposition.children.find(el => el.attrs['data-anov-segment'] === key), x1 = Number(line.attrs.x1), x2 = Number(line.attrs.x2);
        close(x1, 126 + (start + 2) / 26 * 474); close(x2, 126 + (end + 2) / 26 * 474);
        assert.ok(x1 >= 126 && x1 <= 600 && x2 >= 126 && x2 <= 600); assert.equal(Math.sign(x2 - x1), Math.sign(end - start));
        const arrow = decomposition.children.find(el => el.attrs['data-anov-arrow'] === key), zero = decomposition.children.find(el => el.attrs['data-anov-zero'] === key);
        assert.equal(Boolean(arrow), start !== end); assert.equal(Boolean(zero), start === end);
        if (arrow) {
          const coords = arrow.attrs.d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
          for (const x of [coords[0], coords[2], coords[4]]) assert.ok(x >= Math.min(x1, x2) - 1e-12 && x <= Math.max(x1, x2) + 1e-12);
        }
      }
      for (const graph of [plot, decomposition]) {
        assert.ok(graph.children.every(el => Object.values(el.attrs).every(value => !/NaN|Infinity/.test(value))));
        for (const el of graph.children) for (const key of ['x', 'x1', 'x2', 'cx']) if (key in el.attrs) assert.ok(Number(el.attrs[key]) >= 0 && Number(el.attrs[key]) <= 680);
      }
      assert.match(decomposition.attrs['aria-label'], /不表示平方和/);
    }
  }
  drawAnova(plot, null); drawAnovaDecomposition(decomposition, null); assert.equal(plot.children.length, 0); assert.equal(decomposition.children.length, 0);
  const elements = {};
  for (const key of ['gap', 'noise', 'gap-value', 'noise-value', 'reset', 'error', 'settings', 'results', 'selected', 'group-sums', 'identity', 'grand', 'conclusion', 'copy', 'code', 'copy-status']) elements[`[data-anov-${key}]`] = new Element();
  for (const kind of ['plot', 'decomposition']) for (const size of ['main', 'large']) elements[`[data-anov-${kind}="${size}"]`] = new Element('svg');
  for (const id of ids) {
    elements[`[data-anov-select="${id}"]`] = new Element('button'); elements[`[data-anov-row="${id}"]`] = new Element('tr');
    for (const key of ['value', 'total', 'between', 'residual', 'totalSquare', 'betweenSquare', 'residualSquare', 'cross']) elements[`[data-anov-cell="${id}-${key}"]`] = new Element('td');
  }
  for (const key of ['sst', 'ssb', 'sse', 'cross']) elements[`[data-anov-sum="${key}"]`] = new Element('td');
  for (let i = 0; i < 3; i++) for (const key of ['ss', 'df', 'ms', 'f', 'p']) elements[`[data-anov-output="${i}-${key}"]`] = new Element('td');
  const root = new Element(); root.querySelector = selector => elements[selector] || null;
  const get = key => elements[`[data-anov-${key}]`], select = id => elements[`[data-anov-select="${id}"]`], output = (i, key) => elements[`[data-anov-output="${i}-${key}"]`];
  get('gap').value = '3'; get('noise').value = '1'; mountAnova(root); mountAnova(root);
  assert.equal(get('gap').events.input.length, 1); assert.equal(select('A1').events.click.length, 1);
  assert.equal(output(0, 'f').textContent, '27'); assert.equal(output(0, 'p').textContent, '0.001');
  assert.equal(output(0, 'ss').textContent, '54'); assert.equal(output(1, 'ss').textContent, '6'); assert.equal(output(2, 'ss').textContent, '60');
  assert.deepEqual([0, 1, 2].map(i => output(i, 'df').textContent), ['2', '6', '8']); assert.equal(output(2, 'ms').textContent, '—'); assert.equal(output(1, 'p').textContent, '—');
  assert.match(get('selected').textContent, /16 = 9 \+ 1 \+ \(6\)/);
  const stableButton = select('A3'), stableRow = elements['[data-anov-row="A3"]'], stableGap = get('gap');
  stableButton.focus(); await stableButton.dispatch('click'); assert.equal(document.activeElement, stableButton); assert.equal(stableButton.attrs['aria-pressed'], 'true');
  assert.match(get('selected').textContent, /4 = 9 \+ 1 \+ \(-6\)/); assert.equal(get('code').textContent, anovaRCode({}, 'A3'));
  get('noise').value = '2'; await get('noise').dispatch('input'); assert.equal(select('A3'), stableButton); assert.equal(elements['[data-anov-row="A3"]'], stableRow);
  assert.match(get('selected').textContent, /^A3：Y=7/); assert.equal(output(0, 'ss').textContent, '54'); assert.equal(output(1, 'ss').textContent, '24'); assert.equal(output(0, 'f').textContent, '6.75');
  get('gap').focus(); get('gap').value = '0'; await get('gap').dispatch('input'); assert.equal(document.activeElement, stableGap);
  assert.equal(output(0, 'f').textContent, '0'); assert.equal(output(0, 'p').textContent, '1'); assert.match(get('settings').textContent, /不表示 H₀.*随机样本.*F=0/);
  await select('B2').dispatch('click'); assert.match(get('selected').textContent, /总偏差 0 = 组间 0 \+ 组内 \(0\)/);
  assert.equal(elements['[data-anov-decomposition="main"]'].children.filter(el => 'data-anov-zero' in el.attrs).length, 3);
  get('gap').value = '6'; get('noise').value = '.25'; await get('noise').dispatch('input');
  assert.equal(output(0, 'f').textContent, '1728'); assert.match(output(0, 'p').textContent, /e-9$/); assert.notEqual(output(0, 'p').textContent, '0');
  for (const kind of ['plot', 'decomposition']) assert.equal(JSON.stringify(elements[`[data-anov-${kind}="main"]`].children), JSON.stringify(elements[`[data-anov-${kind}="large"]`].children));
  await get('copy').dispatch('click'); assert.equal(copied, anovaRCode({ gap: 6, noise: .25 }, 'B2')); assert.match(get('copy-status').textContent, /已复制/);
  failCopy = true; await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中上方/); failCopy = false;
  waitCopy = true; const pending = get('copy').dispatch('click'); await select('C1').dispatch('click'); resolveCopy(); await pending; waitCopy = false; assert.equal(get('copy-status').textContent, '');
  for (const [field, bad] of [['gap', ''], ['gap', '6.25'], ['gap', '.1'], ['gap', '0x4'], ['noise', '0'], ['noise', '5.25'], ['noise', 'NaN']]) {
    get(field).value = bad; await get(field).dispatch('input');
    assert.equal(get('results').hidden, true); assert.equal(get('copy').disabled, true); assert.equal(get('code').textContent, ''); assert.equal(select('A1').disabled, true);
    for (const kind of ['plot', 'decomposition']) for (const size of ['main', 'large']) assert.equal(elements[`[data-anov-${kind}="${size}"]`].children.length, 0);
    assert.match(get('error').textContent, /当前不显示旧结果/);
    await get('reset').dispatch('click'); assert.equal(get('results').hidden, false); assert.equal(get('copy').disabled, false); assert.equal(select('A1').disabled, false); assert.equal(select('A1').attrs['aria-pressed'], 'true');
    assert.equal(get('code').textContent, anovaRCode()); assert.equal(output(0, 'f').textContent, '27'); assert.equal(output(0, 'p').textContent, '0.001');
  }
  assert.match(root.innerHTML, /不是从某个总体反复随机抽样/); assert.match(root.innerHTML, /不自动等于真实处理效应或因果效应/);
  assert.match(get('grand').textContent, /3×5\+3×8\+3×11.*按 n 加权/);
} finally {
  if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator;
}
console.log(`ANOVA: all ${settings.length} slider states matched independent R (including relative F-tail accuracy); ${exportCases.length} actual R exports executed; every state × nine selections passed signed-segment/point geometry, cross-term identities, stable focus/IDs, invalid recovery and copy lifecycle.`);
