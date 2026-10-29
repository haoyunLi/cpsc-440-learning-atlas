import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { transformationSummary, transformationAxis, transformationRCode } from '../assets/transformation.mjs';

const cases = [
  [.625, 3.625, 8.625, 15.625, 24.625],
  [2, 3, 3, 4, 40], [4, 4, 4, 4], [0, 0, 1, 2, 5, 9],
  [1e-8, 2e-8, 5e-8], [999999.8, 999999.9, 1000000]
];
const expressions = { identity: ['y', 'mean(t)'], sqrt: ['sqrt(y)', 'mean(t)^2'], shifted: ['sqrt(y+3/8)', 'mean(t)^2-3/8'], log: ['log(y)', 'exp(mean(t))'] };
const comparisons = cases.flatMap(values => Object.keys(expressions).filter(mode => mode !== 'log' || !values.includes(0)).map(mode => ({ values, mode })));
const r = comparisons.map(({ values, mode }) => `y <- c(${values.join(',')}); t <- ${expressions[mode][0]}; cat(sprintf("%.17g", c(mean(y),mean(t),var(t),${expressions[mode][1]})),sep=","); cat("\\n")`).join('\n');
const reference = execFileSync('Rscript', ['--vanilla', '-e', r], { encoding: 'utf8' }).trim().split('\n').map(line => line.split(',').map(Number));
comparisons.forEach(({ values, mode }, i) => {
  const got = transformationSummary(values, mode), expected = reference[i];
  [got.rawMean, got.transformedMean, got.transformedVariance, got.backCenter].forEach((value, j) => {
    assert.ok(Math.abs(value - expected[j]) <= 1e-12 * Math.max(Math.abs(expected[j]), 1), `${mode}: ${value} vs R ${expected[j]}`);
  });
  assert.ok(got.backCenter <= got.rawMean + 1e-10 * Math.max(1, got.rawMean));
  if (got.squareCorrection !== null) assert.ok(Math.abs(got.backCenter + got.squareCorrection - got.rawMean) < 1e-9 * Math.max(1, got.rawMean));
  for (const sample of [values, got.transformed]) {
    const axis = transformationAxis(sample);
    assert.equal(new Set(axis.ticks.map(t => t.label)).size, 3);
    assert.ok(sample.every(y => Number.isFinite(axis.position(y)) && axis.position(y) >= 0 && axis.position(y) <= 1));
  }
});
const worked = transformationSummary(cases[0], 'shifted');
assert.equal(worked.rawMean, 10.625);
assert.equal(worked.backCenter, 8.625);
assert.equal(worked.squareCorrection, 2);
// Analytic two-point identities expose gaps hidden by subtraction of large means.
for (const mode of ['sqrt', 'shifted']) {
  const r = transformationSummary([999999.999, 1000000], mode);
  assert.ok(Math.abs(r.gap / 6.25e-14 - 1) < 1e-6);
  assert.equal(r.gap, r.squareCorrection);
}
const tinyGap = transformationSummary([1e-8, 1.00000001e-8], 'shifted');
assert.ok(Math.abs(tinyGap.gap / 1.66666662e-33 - 1) < 1e-6);
const limitedLog = transformationSummary([999999.999, 1000000], 'log');
assert.equal(limitedLog.gapLimited, true);
assert.equal(limitedLog.gap, null);
for (const mode of Object.keys(expressions)) {
  const r = transformationSummary([4, 4, 4], mode);
  assert.equal(r.gap, 0);
  assert.equal(r.transformedVariance, 0);
  execFileSync('Rscript', ['--vanilla', '-e', `options(warn=2)\n${transformationRCode(cases[0], mode)}`], { encoding: 'utf8' });
}
for (const values of [[1, NaN], [-1, 2], [1], [1e-10, 2], [1e7, 2], Array(81).fill(1)]) assert.throws(() => transformationSummary(values));
assert.throws(() => transformationSummary([0, 1], 'log'), /log/);
assert.throws(() => transformationSummary([1, 2], 'unknown'));
assert.equal(transformationSummary([0, 0], 'shifted').backCenter, 0);
console.log(`${comparisons.length} transformations match independent R summaries; domains, constant data, second-moment identity, chart scales and generated R passed.`);
