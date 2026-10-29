import assert from 'node:assert/strict';
import { summaryAnalysis, formatSummaryNumber, formatSummaryTick } from '../assets/atlas.mjs';

const near = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} versus ${expected}`);
const small = summaryAnalysis([1e-6, 2e-6, 3e-6]);
near(small.mean, 2e-6, 1e-20);
near(small.variance, 1e-12, 1e-25);
near(small.sd, 1e-6, 1e-20);
assert.equal(small.varianceText, '1e-12');
assert.equal(Number(small.sdText), 1e-6);
assert.equal(small.axis.exponent, -6);
assert.deepEqual(small.counts, [1, 0, 0, 1, 0, 0, 1]);
assert.equal(formatSummaryNumber(small.fences[0], small.spread), '≈0');

const large = summaryAnalysis([1e9, 1e9 + 1, 1e9 + 2]);
assert.equal(large.axis.offset, 1e9);
assert.equal(large.axis.start, 0);
assert.equal(large.axis.end, 2);
assert.equal(formatSummaryNumber(large.mean, large.spread), '1000000001');
near(large.sd, 1);

// Constant decimals must not acquire variance from summation roundoff.
for (const value of [0, .1, -1e-6, 1e9 + .000001]) {
  const r = summaryAnalysis(Array(30).fill(value));
  assert.equal(r.mean, value);
  assert.equal(r.sd, 0);
  assert.equal(r.variance, 0);
  assert.equal(r.varianceText, '0');
  assert.equal(formatSummaryNumber(r.mean, r.spread), String(value));
  assert.equal(r.counts.reduce((sum, count) => sum + count, 0), 30);
  assert.equal(r.counts.filter(count => count > 0).length, 1);
}

for (const values of [[2, 3, 3, 4, 18], [-.03, -.02, -.01], [1e-100, 2e-100, 3e-100], [1e9 + .0001, 1e9 + .0002, 1e9 + .0003], [-1e10, 0, 1e10]]) {
  for (const bins of [3, 7, 20]) {
    const r = summaryAnalysis(values, bins), { start, end } = r.axis;
    assert.ok(Number.isFinite(start) && Number.isFinite(end) && end > start);
    assert.ok(Number.isFinite(r.meanPosition) && r.meanPosition >= start && r.meanPosition <= end);
    assert.equal(r.counts.reduce((sum, count) => sum + count, 0), values.length);
    const ticks = Array.from({length:5}, (_, i) => formatSummaryTick(start + (end - start) * i / 4, end - start));
    assert.equal(new Set(ticks).size, 5);
    assert.ok(ticks.every(text => text.length < 12), ticks.join(', '));
  }
}
assert.throws(() => summaryAnalysis([1, NaN]));
assert.throws(() => summaryAnalysis([1, 2], 0));
console.log('Summary scale, scientific notation, exact constants, offset axes and histogram counts passed.');
