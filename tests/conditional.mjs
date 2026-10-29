import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { conditionalExamples, contingencySummary, conditionalRCode, conditionalProbabilityLabel } from '../assets/conditional.mjs';

const tables=[conditionalExamples.original,conditionalExamples.independent,[[0,0,0],[2,4,6]],[[0,0,1],[0,3,0]],[[10000,1,0],[1,0,10000]],[[0,0,0],[0,0,1]]];
const cases=tables.flatMap(counts=>[0,1].flatMap(row=>[0,1,2].map(column=>({counts,row,column}))));
const r=cases.map(({counts,row,column})=>`m<-matrix(c(${counts.flat()}),2,byrow=TRUE);i<-${row+1};j<-${column+1};N<-sum(m);a<-sum(m[i,]);b<-sum(m[,j]);ab<-m[i,j];cat(c(N,a,b,ab,a/N,b/N,ab/N,if(b>0)ab/b else NA_real_,if(a>0)ab/a else NA_real_,ab*N==a*b),sep=",");cat("\\n")`).join('\n');
const references=execFileSync('Rscript',['--vanilla','-e',r],{encoding:'utf8'}).trim().split('\n').map(line=>line.split(',').map(x=>x==='NA'?null:Number(x)));
cases.forEach(({counts,row,column},i)=>{
 const s=contingencySummary(counts,row,column);
 const values=[s.total,s.A,s.B,s.intersection,s.pA,s.pB,s.joint,s.aGivenB,s.bGivenA,Number(s.independent)];
 values.forEach((v,j)=>v===null||references[i][j]===null ? assert.equal(v,references[i][j]) : assert.ok(Math.abs(v-references[i][j])<1e-6));
 assert.equal(s.rows.reduce((a,b)=>a+b),s.total);assert.equal(s.columns.reduce((a,b)=>a+b),s.total);
});
const original=contingencySummary(conditionalExamples.original);
assert.equal(original.aGivenB,.3);assert.equal(original.bGivenA,.45);assert.equal(original.joint,.09);assert.equal(original.independent,false);
const independent=contingencySummary(conditionalExamples.independent);
assert.equal(independent.independent,true);assert.deepEqual(original.rows,independent.rows);assert.deepEqual(original.columns,independent.columns);
// An empty event is independent but cannot be used as a conditioning denominator.
const empty=contingencySummary([[0,0,0],[2,4,6]]);
assert.equal(empty.aGivenB,0);assert.equal(empty.bGivenA,null);assert.equal(empty.independent,true);
assert.notEqual(Number(conditionalProbabilityLabel(1/40001)),0);
assert.notEqual(Number(conditionalProbabilityLabel(29999/30000)),1);
assert.equal(conditionalProbabilityLabel(0),'0.0000');
assert.equal(conditionalProbabilityLabel(1),'1.0000');
assert.equal(conditionalProbabilityLabel(null),'未定义');
for(const bad of [[],[[1,2],[3,4]],[[0,0,0],[0,0,0]],[[1,-1,2],[3,4,5]],[[1,2,.1],[3,4,5]],[[Infinity,2,1],[3,4,5]],[[10001,2,1],[3,4,5]],[[null,2,1],[3,4,5]]]) assert.throws(()=>contingencySummary(bad));
assert.throws(()=>contingencySummary(tables[0],2,0));assert.throws(()=>contingencySummary(tables[0],0,3));
for(const counts of tables) execFileSync('Rscript',['--vanilla','-e',`options(warn=2)\n${conditionalRCode(counts)}`],{encoding:'utf8'});
console.log(`${cases.length} contingency scenarios match independent R; zero conditioning events, exact independence, unchanged marginals, domains and generated R passed.`);
