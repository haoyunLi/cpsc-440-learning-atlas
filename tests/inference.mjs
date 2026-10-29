import assert from 'node:assert/strict';
import { inferenceProbabilities } from '../assets/atlas.mjs';

const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} versus ${expected}`);
const evaluate = (tail, delta) => inferenceProbabilities({ n: 25, sigma: 10, delta, alpha: .05, tail });
// Independent R pnorm/qnorm values. Inverting the teaching normal-CDF
// approximation and applying it again gives absolute errors below 1e-6 here.
for (const [tail, delta, classification, nonRejection] of [
  ['right', -4, 'null', .99986622798540126],
  ['right', 0, 'boundary', .95],
  ['right', 4, 'alternative', .3612399686876645],
  ['left', -4, 'alternative', .3612399686876645],
  ['left', 0, 'boundary', .95],
  ['left', 4, 'null', .99986622798540126],
  ['two', -4, 'alternative', .48399472602382498],
  ['two', 0, 'boundary', .95],
  ['two', 4, 'alternative', .48399472602382504]
]) {
  const r = evaluate(tail, delta);
  assert.equal(r.classification, classification);
  near(r.nonRejection, nonRejection);
  near(r.rejection, 1 - nonRejection);
  if (classification === 'alternative') {
    assert.equal(r.beta, r.nonRejection);
    assert.equal(r.power, r.rejection);
  } else {
    assert.equal(r.beta, null);
    assert.equal(r.power, null);
  }
}
for (const tail of ['left', 'right', 'two']) {
  for (const n of [4, 25, 200]) for (const sigma of [1, 10, 20]) for (const delta of [-8, 0, 8]) for (const alpha of [.01, .05, .2]) {
    const r = inferenceProbabilities({ n, sigma, delta, alpha, tail });
    assert.ok(r.rejection >= 0 && r.rejection <= 1 && r.nonRejection >= 0 && r.nonRejection <= 1);
    near(r.rejection + r.nonRejection, 1);
    if (delta === 0) near(r.rejection, alpha);
  }
}
assert.throws(() => inferenceProbabilities({ n: 0, sigma: 10, delta: 0, alpha: .05, tail: 'right' }), /无效/);
assert.throws(() => inferenceProbabilities({ n: 25, sigma: 10, delta: NaN, alpha: .05, tail: 'right' }), /无效/);
console.log('Inference probabilities, null/alternative classification and control boundaries passed.');
