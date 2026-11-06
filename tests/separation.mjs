import assert from 'node:assert/strict';
import { separationExample } from '../assets/separation.mjs';

// Base R from the twelve original observations gives these cutoffs.
const expected = {
  lsd: { threshold: 3.918170581402625, letters: ['c', 'b', 'a'], reject: [true, true, true] },
  tukey: { threshold: 4.835895619035592, letters: ['b', 'ab', 'a'], reject: [false, false, true] },
};
for (const [method, reference] of Object.entries(expected)) {
  const state = separationExample(method);
  assert.ok(Math.abs(state.threshold - reference.threshold) < 1e-6, method);
  assert.deepEqual(state.letters, reference.letters);
  assert.deepEqual(state.comparisons.map(pair => pair.gap), [4, 4, 8]);
  assert.deepEqual(state.comparisons.map(pair => pair.reject), reference.reject);
  for (const { i, j, reject } of state.comparisons) {
    const shareLetter = [...state.letters[i]].some(letter => state.letters[j].includes(letter));
    assert.equal(shareLetter, !reject);
  }
}
assert.throws(() => separationExample('unknown'), RangeError);
console.log('LSD and Tukey cutoffs agree with base R; all letters match the three pair decisions.');
