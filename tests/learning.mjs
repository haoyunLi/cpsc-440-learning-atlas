import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeAnswer, answerFeedback, practiceLocation} from '../assets/learning.mjs';

const questions = JSON.parse(readFileSync(new URL('../content/practice.json', import.meta.url), 'utf8'));
assert.ok(questions.length >= 40, 'The course bank must cover the planned problem families.');
assert.equal(new Set(questions.map(q => q.chapter)).size, 10);
assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
for (const q of questions) {
  assert.ok(q.steps.length >= 3 && q.hint && q.pitfall && q.conclusion && q.rCode, q.id);
  assert.equal(gradeAnswer(q, String(q.answer)).correct, true, q.id);
  for (const invalid of ['', ' ', 'NaN', 'Infinity', '2abc', '2,4', null]) assert.equal(gradeAnswer(q, invalid).valid, false, `${q.id}: ${invalid}`);
  assert.equal(gradeAnswer(q, String(q.answer + (q.type === 'choice' ? 1 : 10 * (q.tolerance || .001)))).correct, false, q.id);
  if (q.type === 'choice') assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id);
  else assert.ok(Number.isFinite(q.answer) && (q.tolerance > 0 || q.integer && q.tolerance === 0), q.id);
  assert.ok(!/Haoyun|haoyun|\/Users\//.test(JSON.stringify(q)), `Private identity in ${q.id}`);
  if (q.type === 'choice') {
    assert.equal(q.optionExplanations.length, q.options.length, q.id);
    q.optionExplanations.forEach((explanation, i) => {
      assert.ok(explanation.length > 15, q.id);
      assert.ok(answerFeedback(q, String(i)).includes(explanation), q.id);
    });
  }
  for (const mistake of q.commonMistakes || []) {
    assert.ok(Number.isFinite(mistake.value) && mistake.tolerance >= 0, q.id);
    assert.equal(gradeAnswer(q, String(mistake.value)).correct, false, `${q.id}: a common mistake must not be the correct answer`);
    assert.ok(answerFeedback(q, String(mistake.value)).includes(mistake.feedback), q.id);
  }
}
assert.ok(questions.filter(q => q.commonMistakes?.length).length >= 15);
assert.equal(gradeAnswer({type:'numeric',answer:-2,tolerance:.001}, '−2').correct, true);
assert.equal(gradeAnswer({type:'numeric',answer:.002,tolerance:.00001}, '2e-3').correct, true);
assert.equal(gradeAnswer({type:'numeric',answer:62,tolerance:.01,integer:true}, '61.995').correct, false);
const previousLocation = 'https://example.org/cpsc-440-learning-atlas/practice.html?chapter=07&q=variance&answer=16#p11-04';
assert.equal(practiceLocation(previousLocation, {mixed:true}), 'https://example.org/cpsc-440-learning-atlas/practice.html?mode=mixed');
assert.equal(practiceLocation(previousLocation), 'https://example.org/cpsc-440-learning-atlas/practice.html');
const filtered = new URL(practiceLocation(previousLocation, {chapter:'05', level:'综合', status:'review', query:' power '}));
assert.equal(filtered.searchParams.get('chapter'), '05');
assert.equal(filtered.searchParams.get('level'), '综合');
assert.equal(filtered.searchParams.get('status'), 'review');
assert.equal(filtered.searchParams.get('q'), 'power');
assert.equal(filtered.searchParams.has('answer'), false);
assert.equal(filtered.hash, '');
const revealed = new URL(practiceLocation(previousLocation, {chapter:'11', mixed:true, question:'p11-04'}));
assert.equal(revealed.searchParams.get('chapter'), '11');
assert.equal(revealed.searchParams.has('mode'), false);
assert.equal(revealed.hash, '#p11-04');
console.log(`${questions.length} practice records validated; grading accepts signed/scientific numbers and rejects invalid answers.`);
