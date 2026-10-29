import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {binomialTailSummary, chapterProbabilityLabel} from '../assets/atlas.mjs';
import {anova, fSurvival} from '../assets/math.mjs';

const cases = [];
const add = (name, actual, reference) => cases.push({name, actual, reference});
for (const n of [1, 20, 60]) for (const p of [0, .01, .15, .5, .85, .99, 1]) {
  for (const k of [...new Set([0, 1, Math.floor(n / 2), n, Math.min(60, n + 1)])]) {
    const r = binomialTailSummary(n, p, k);
    add(`P(Y>=${k}), n=${n}, p=${p}`, r.right, `pbinom(${k-1},${n},${p},lower.tail=FALSE)`);
    add(`P(Y<${k}), n=${n}, p=${p}`, r.below, `pbinom(${k-1},${n},${p})`);
    assert.ok(Math.abs(r.right + r.below - 1) < 1e-12);
  }
}
for (const df1 of [1, 2, 4]) for (const df2 of [3, 12, 99]) for (const f of [0, 1, 27, 1152, 1e8]) {
  add(`F upper ${f},${df1},${df2}`, fSurvival(f, df1, df2), `pf(${f},${df1},${df2},lower.tail=FALSE)`);
}
for (const gap of [0, .25, 3, 6]) for (const noise of [.25, 1, 5]) {
  const groups = [0,1,2].map(i => [-1,0,1].map(e => 5 + i * gap + e * noise));
  const r = anova(groups);
  add(`ANOVA gap=${gap} noise=${noise}`, r.p,
    `{y<-c(${groups.flat().join(',')});g<-factor(rep(1:3,each=3));anova(lm(y~g))[1,"Pr(>F)"]}`);
}
const refs = execFileSync(process.env.RSCRIPT || 'Rscript', ['--vanilla','-e',
  `cat(sprintf('%.17g\\n',c(${cases.map(c=>c.reference).join(',')})))`], {encoding:'utf8'}).trim().split(/\s+/).map(Number);
assert.equal(refs.length, cases.length);
for (const [i,c] of cases.entries()) {
  assert.ok(Number.isFinite(c.actual) && c.actual >= 0 && c.actual <= 1, c.name);
  // Relative accuracy catches errors that an absolute tolerance would miss at 1e-120.
  assert.ok(refs[i] === 0 ? c.actual === 0 : Math.abs(c.actual/refs[i]-1) < 1e-10, `${c.name}: ${c.actual} vs ${refs[i]}`);
}
const tiny = binomialTailSummary(60,.01,60);
assert.equal(chapterProbabilityLabel(tiny.right,tiny.below), '1.000e-120');
const nearOne = binomialTailSummary(60,.99,1);
assert.equal(chapterProbabilityLabel(nearOne.right,nearOne.below), '1 − 1.000e-120');
assert.equal(chapterProbabilityLabel(0,1), '0');
assert.equal(chapterProbabilityLabel(1,0), '1');
assert.equal(chapterProbabilityLabel(.3,.7), '0.300000');
assert.equal(chapterProbabilityLabel(NaN), '—');
assert.notEqual(chapterProbabilityLabel(anova([[-1,0,1],[9,10,11],[19,20,21]]).p,undefined,5), '0.00000');
for (const args of [[0,.5,0],[61,.5,0],[20,-.1,4],[20,.5,2.5]]) assert.throws(()=>binomialTailSummary(...args));
console.log(`${cases.length} independent R tail checks (relative tolerance), boundary cases and tiny/near-one probability labels passed.`);
