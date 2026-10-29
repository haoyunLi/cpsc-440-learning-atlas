import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boxplotAnalysis, boxplotRCode, drawBoxplot } from '../assets/boxplot.mjs';
import { formatSummaryTick } from '../assets/atlas.mjs';

const cases = [
  { name: 'rule difference', values: [2, 3, 4, 12] },
  { name: 'default', values: [2, 3, 3, 4, 18] },
  { name: 'both exact fences', values: [-2, 1, 2, 3, 6] },
  { name: 'just beyond fences', values: [-2.0001, 1, 2, 3, 6.0001] },
  { name: 'zero IQR with candidate', values: [3, 3, 3, 3, 30] },
  { name: 'tied candidates', values: [-9, -9, 0, 0, 0, 0, 0, 0, 9, 9] },
  { name: 'negative observations', values: [-20, -8, -4, -3, -2, -2] },
  { name: 'zero constant', values: [0, 0, 0, 0] },
  { name: 'decimal constant', values: [.1, .1, .1, .1, .1] },
  { name: 'negative constant', values: [-8, -8] },
  { name: 'small units', values: [2, 3, 4, 12].map(v => v * 1e-9) },
  { name: 'very small units', values: [2, 3, 4, 12].map(v => v * 1e-200) },
  { name: 'small negative units', values: [-20, -8, -4, -3, -2, -2].map(v => v * 1e-9) },
  { name: 'large offset', values: [2, 3, 4, 12].map(v => v + 9999999980) },
  { name: 'large offset decimal differences', values: [1e9 + .0001, 1e9 + .0002, 1e9 + .0003, 1e9 + .0009] },
  { name: 'wide range', values: [-1e10, -2, 0, 3, 1e10] },
  { name: 'large constant', values: Array(30).fill(1e10) }
];
// Cover all n modulo 4, both parity rules, repeated values, and the input limit.
for (const n of [...Array.from({ length: 32 }, (_, i) => i + 2), 100, 499, 500]) {
  cases.push({ name: `n=${n}`, values: Array.from({ length: n }, (_, i) => (i * 13 % 19) - 8 + (i === n - 1 ? 25 : 0)) });
}

const rules = ['type7', 'hinges'];
const records = cases.flatMap((sample, id) => rules.map(rule => ({ ...sample, id, rule, analysis: boxplotAnalysis(sample.values, rule) })));
const close = (actual, expected, range, message) => {
  const tolerance = Math.max(Number.MIN_VALUE * 8, 8 * Number.EPSILON * Math.max(Math.abs(actual), Math.abs(expected)), Math.abs(range) * 1e-12);
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} versus R ${expected}`);
};
const compareArray = (actual, expected, range, message) => {
  assert.equal(actual.length, expected.length, `${message}: length`);
  actual.forEach((value, i) => close(value, expected[i], range, `${message}[${i}]`));
};

// Run base R's independent implementations and every generated R snippet in a
// temporary directory. Graphics go to one PDF, never into the repository.
const temporary = mkdtempSync(join(tmpdir(), 'cpsc440-boxplot-'));
try {
  const blocks = records.map(({ id, rule, values }) => `local({
  original_y <- c(${values.join(', ')})
  reference_q <- ${rule === 'type7' ? 'unname(quantile(original_y,c(.25,.5,.75),type=7))' : 'fivenum(original_y)[2:4]'}
  reference_iqr <- reference_q[3]-reference_q[1]
  reference_fences <- c(reference_q[1]-1.5*reference_iqr,reference_q[3]+1.5*reference_iqr)
  reference_outside <- original_y < reference_fences[1] | original_y > reference_fences[2]
  reference_whiskers <- range(original_y[!reference_outside])
  reference_candidates <- sort(original_y[reference_outside])
  ${rule === 'hinges' ? `standard <- boxplot.stats(original_y,coef=1.5,do.conf=FALSE)
  stopifnot(identical(unname(standard$stats[2:4]),unname(reference_q)),
            identical(unname(standard$stats[c(1,5)]),unname(reference_whiskers)),
            identical(sort(standard$out),reference_candidates))` : ''}
  emit <- function(x) paste(sprintf("%.17g",x),collapse=",")
  cat("BOXREF",${id},"${rule}",emit(reference_q),emit(reference_fences),
      emit(reference_whiskers),emit(reference_candidates),sep="\\t")
  cat("\\n")
  invisible(capture.output({
${boxplotRCode(values, rule)}
  }))
  stopifnot(identical(y,original_y),identical(unname(q),unname(reference_q)),
            identical(unname(fences),unname(reference_fences)),
            identical(unname(whiskers),unname(reference_whiskers)),
            identical(sort(y[outside]),reference_candidates))
})`);
  const script = join(temporary, 'verify.R');
  writeFileSync(script, `pdf("generated-boxplots.pdf")\n${blocks.join('\n')}\ndev.off()\n`);
  const stdout = execFileSync(process.env.RSCRIPT || 'Rscript', [script], { cwd: temporary, encoding: 'utf8', maxBuffer: 4e6 });
  const references = stdout.split('\n').filter(line => line.startsWith('BOXREF\t'));
  assert.equal(references.length, records.length);
  assert.ok(statSync(join(temporary, 'generated-boxplots.pdf')).size > 1000);
  references.forEach((line, i) => {
    const [marker, id, rule, ...columns] = line.split('\t'), record = records[i];
    assert.equal(Number(id), record.id); assert.equal(rule, record.rule);
    const expected = columns.map(column => column ? column.split(',').map(Number) : []);
    const { analysis: result } = record, range = Math.max(...record.values) - Math.min(...record.values);
    for (const [j, field] of ['quartiles', 'fences', 'whiskers', 'outliers'].entries()) compareArray(result[field], expected[j], range, `${record.name}/${rule}/${field}`);
  });
} finally { rmSync(temporary, { recursive: true, force: true }); }

const type7 = boxplotAnalysis([2, 3, 4, 12], 'type7'), hinges = boxplotAnalysis([2, 3, 4, 12], 'hinges');
assert.deepEqual(type7.quartiles, [2.75, 3.5, 6]);
assert.deepEqual(hinges.quartiles, [2.5, 3.5, 8]);
assert.deepEqual(type7.whiskers, [2, 4]); assert.deepEqual(hinges.whiskers, [2, 12]);
assert.deepEqual(type7.outliers, [12]); assert.deepEqual(hinges.outliers, []);
assert.deepEqual(type7.points.map(point => point.value), hinges.points.map(point => point.value));
for (const rule of rules) {
  assert.deepEqual(boxplotAnalysis([-2, 1, 2, 3, 6], rule).outliers, []);
  assert.deepEqual(boxplotAnalysis([-2.0001, 1, 2, 3, 6.0001], rule).outliers, [-2.0001, 6.0001]);
  const original = [12, 4, 3, 2]; boxplotAnalysis(original, rule);
  assert.deepEqual(original, [12, 4, 3, 2], 'Analysis must not reorder the supplied observations');
}
for (const values of [[], [1], Array(501).fill(1), [1, NaN], [1, Infinity], [0, 1e10 + 1]]) assert.throws(() => boxplotAnalysis(values));
assert.throws(() => boxplotAnalysis([1, 2], 'unknown'));

class Element {
  constructor(tag = 'svg') { this.tag = tag; this.attrs = {}; this.children = []; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
}
const priorDocument = globalThis.document;
globalThis.document = { createElementNS: (namespace, tag) => new Element(tag) };
try {
  const graph = new Element();
  const geometryCases = [...records, ...[[Number.MIN_VALUE, Number.MIN_VALUE], [Number.MIN_VALUE, 2 * Number.MIN_VALUE]].flatMap(values => rules.map(rule => ({ name: 'subnormal geometry', rule, values, analysis: boxplotAnalysis(values, rule) })))];
  for (const { values, analysis: result, name, rule } of geometryCases) {
    drawBoxplot(graph, result, formatSummaryTick);
    const circles = graph.children.filter(el => el.tag === 'circle');
    assert.equal(circles.length, values.length, `${name}/${rule}: every raw point remains in the SVG`);
    assert.equal(circles.filter(el => el.attrs['data-box-point'] === 'candidate').length, result.outliers.length);
    for (const node of graph.children) {
      for (const key of ['x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'width', 'height', 'r']) {
        if (key in node.attrs) assert.ok(Number.isFinite(Number(node.attrs[key])), `${name}/${rule}: finite ${key}`);
      }
    }
    circles.forEach((circle, i) => {
      const x = +circle.attrs.cx, y = +circle.attrs.cy, radius = +circle.attrs.r;
      assert.ok(x - radius >= 85 && x + radius <= 635 && y - radius >= 45 && y + radius <= 265, `${name}/${rule}: full point inside frame`);
      assert.equal(circle.attrs['data-box-point'], result.points[i].outlier ? 'candidate' : 'inside');
    });
    for (const mark of ['fence', 'whisker', 'median', 'box']) {
      const nodes = graph.children.filter(el => el.attrs['data-box-mark'] === mark);
      assert.equal(nodes.length, mark === 'fence' || mark === 'whisker' ? 2 : 1);
      nodes.forEach(node => {
        const left = +(node.attrs.x ?? node.attrs.x1), right = node.tag === 'rect' ? left + +node.attrs.width : +node.attrs.x2;
        assert.ok(left >= 85 && right <= 635 && right >= left, `${name}/${rule}: ${mark} inside frame`);
      });
    }
    const ticks = graph.children.filter(el => el.tag === 'text' && el.attrs.class === 'plot-muted').map(el => el.textContent);
    assert.equal(new Set(ticks).size, 5, `${name}/${rule}: readable distinct ticks`);
  }
} finally { if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument; }
console.log(`${records.length} independent R boxplot references and generated R plots passed; all raw points, fences, whiskers and box endpoints are finite and inside the SVG frame.`);
