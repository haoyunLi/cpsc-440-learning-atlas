import assert from 'node:assert/strict';
import { distribution, tailProbability, parseSample, twoSample, diagnosticData, chooseMethod } from '../assets/workbench.mjs';
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} versus ${expected}`);
// Reference values independently calculated with R 4.x pnorm/pt/pchisq/pf and q*.
for (const [kind, d1, d2, observed, cdf, q975] of [
  ['normal', 10, 20, 2, .9772498680518208, 1.959963984540054],
  ['t', 10, 20, 2, .9633059826146297, 2.228138851986274],
  ['chi', 10, 20, 12, .7149434996833688, 20.4831773508074],
  ['f', 5, 12, 2, .849073920907063, 3.891133933902388]
]) {
  const d = distribution(kind, d1, d2);
  near(d.cdf(observed), cdf);
  near(d.quantile(.975), q975, 3e-6);
  near(tailProbability(kind, observed, 'left', d1, d2).p, cdf);
  near(tailProbability(kind, observed, 'right', d1, d2).p, 1 - cdf);
  near(tailProbability(kind, observed, 'two', d1, d2).p, 2 * Math.min(cdf, 1 - cdf));
}
const a = [8, 10, 13, 14, 18, 20], b = [7, 8, 10, 12, 12, 13];
for (const [kind, x, d1, d2, expected] of [
  ['normal', 10, 10, 20, 7.6198530241605269e-24],
  ['t', 20, 100, 20, 4.9971339306684723e-37],
  ['chi', 100, 5, 20, 5.28514836094324e-20],
  ['f', 100, 5, 100, 2.6128192243443594e-37]
]) {
  near(tailProbability(kind, x, 'right', d1, d2).p / expected, 1, 1e-10);
  assert.ok(tailProbability(kind, x, 'two', d1, d2).p > 0);
}
near(twoSample([100, 100.1, 100.2, 100.3], [0, .1, .2, .3]).p / 3.9061987309301338e-17, 1, 1e-10);
// R t.test reference values (rounded; tolerances reflect displayed precision).
for (const [method, t, df, p, low, high] of [
  ['welch', 1.655032, 7.594927, .1385258, -1.422298, 8.422298],
  ['pooled', 1.655032, 10, .1289186, -1.211985, 8.211985],
  ['paired', 3.529536, 5, .01674803, .9509297, 6.049070]
]) {
  const r = twoSample(a, b, method);
  for (const [actual, expected] of [[r.t, t], [r.df, df], [r.p, p], [r.low, low], [r.high, high]]) near(actual, expected, 2e-6);
  near(twoSample(b, a, method).estimate, -r.estimate);
  near(twoSample(b, a, method).p, r.p);
}
assert.throws(() => parseSample(''), /请输入/);
assert.throws(() => parseSample('2, not-a-number'), /请输入/);
assert.throws(() => parseSample('1, Infinity'), /请输入/);
assert.deepEqual(parseSample('1，2;3 4'), [1, 2, 3, 4]);
assert.deepEqual(parseSample(' 1, 2 \n 3e-2; -.5 '), [1, 2, .03, -.5]);
for (const raw of ['1,2,', ',1,2', '1,,2', '1, ,2', '1；；2', '1,\n,2']) assert.throws(() => parseSample(raw), /空字段/);
assert.throws(() => parseSample('1,NaN'), /请输入/);
assert.throws(() => parseSample('0x20,2'), /请输入/);
assert.throws(() => twoSample([1, 2, 3], [1, 2], 'paired'), /长度相同/);
assert.throws(() => twoSample([1, 1], [2, 2]), /标准误为 0/);
assert.throws(() => twoSample([1, 2], [2, 3], 'paired'), /标准误为 0/);
assert.throws(() => tailProbability('chi', -1, 'left'), /不能为负数/);
assert.throws(() => distribution('f', 0, 20), /自由度/);
for (const mode of ['normal', 'skew', 'outlier', 'unequal']) {
  const r = diagnosticData(mode);
  assert.equal(r.n, 48);
  assert.deepEqual(r, diagnosticData(mode));
  assert.ok(r.points.every(p => Number.isFinite(p.residual)));
  for (let group = 0; group < 3; group++) near(r.points.filter(p => p.group === group).reduce((sum, p) => sum + p.residual, 0), 0);
  near(r.theoretical[0], distribution('normal').quantile(.5 / 48));
}
assert.equal(chooseMethod({ goal: 'variance', groups: 'one' }).chapter, '07');
assert.equal(chooseMethod({ goal: 'mean', design: 'paired', groups: 'two' }).chapter, '06');
assert.match(chooseMethod({ goal: 'mean', design: 'paired', groups: 'many' }).title, /相关观测/);
assert.equal(chooseMethod({ goal: 'mean', design: 'blocked' }).chapter, '15');
assert.equal(chooseMethod({ goal: 'mean', factors: 'two' }).chapter, '14');
assert.equal(chooseMethod({ goal: 'relationship' }).chapter, '11');
console.log('Workbench numerical references, invalid inputs, deterministic diagnostics and method routing passed.');
