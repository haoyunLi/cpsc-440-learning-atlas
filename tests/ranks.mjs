import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rankExperiment, rankHistogram, rankTail } from '../assets/ranks.mjs';

// Independent R enumeration keeps tied observations as distinct units.
const r = `
options(warn=2)
x <- c(3,4,5,5,8,9)
scores <- rank(x)
w <- combn(seq_along(x), 3, function(i) sum(scores[i]))
cat(sort(w), sep=","); cat("\\n")
d <- c(0,-1,2,2,3,4)
d <- d[d!=0]
scores <- rank(abs(d))
signs <- expand.grid(rep(list(c(0,1)), length(d)))
w <- as.vector(as.matrix(signs) %*% scores)
cat(sort(w), sep=","); cat("\\n")
`;
const reference = execFileSync('Rscript', ['--vanilla', '-e', r], { encoding: 'utf8' }).trim().split('\n').map(line => line.split(',').map(Number));
['rank-sum', 'signed-rank'].forEach((mode, i) => {
  const e = rankExperiment(mode), stats = e.allocations.map(a => a.statistic).sort((a, b) => a - b);
  assert.deepEqual(stats, reference[i]);
  assert.equal(new Set(e.allocations.map(a => a.selected.join(','))).size, e.allocations.length);
  assert.equal(stats.reduce((sum, x) => sum + x, 0) / stats.length, e.center);
  assert.deepEqual(stats, stats.map(x => 2 * e.center - x).reverse());
  const hist = rankHistogram(e);
  assert.equal(hist.reduce((sum, b) => sum + b.count, 0), e.allocations.length);
  assert.ok(hist.some(b => b.count > 1), 'Tied statistics retain their multiplicities');
  assert.equal(rankTail(e, 'two').probability, Math.min(1, 2 * Math.min(rankTail(e, 'less').probability, rankTail(e, 'greater').probability)));
  assert.ok(e.allocations.some(a => a.statistic === e.observed));
});
const independent = rankExperiment();
assert.equal(rankTail(independent).count, 4);
assert.equal(rankTail(independent, 'greater').count, 18);
assert.equal(rankTail(independent, 'two').probability, .4);
assert.deepEqual(independent.scores, [1,2,3.5,3.5,5,6]);
assert.ok(independent.allocations.every(a => a.selected.length === 3));
const signed = rankExperiment('signed-rank');
assert.equal(signed.values.length, 5);
assert.deepEqual(signed.scores, [1,2.5,2.5,4,5]);
assert.equal(rankTail(signed, 'greater').probability, .0625);
assert.equal(rankTail(signed, 'two').probability, .125);
assert.throws(() => rankExperiment('invalid'));
assert.throws(() => rankTail(signed, 'invalid'));
console.log('All 20 label allocations and 32 sign allocations match independent R; multiplicities, symmetry, inclusive tails and zero removal passed.');
