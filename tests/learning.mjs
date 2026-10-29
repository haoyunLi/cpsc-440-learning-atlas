import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gradeAnswer} from '../assets/learning.mjs';

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
}
assert.equal(gradeAnswer({type:'numeric',answer:-2,tolerance:.001}, '−2').correct, true);
assert.equal(gradeAnswer({type:'numeric',answer:.002,tolerance:.00001}, '2e-3').correct, true);
assert.equal(gradeAnswer({type:'numeric',answer:62,tolerance:.01,integer:true}, '61.995').correct, false);
console.log(`${questions.length} practice records validated; grading accepts signed/scientific numbers and rejects invalid answers.`);
