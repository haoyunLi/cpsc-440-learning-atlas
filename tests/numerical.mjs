import * as M from '../assets/math.mjs';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const cases=[]; const add=(name,got,r,tol=1e-9)=>cases.push({name,got,r,tol});
for(const x of [-6,-3,-1,0,1,3,6])add(`normalCDF(${x})`,M.normalCDF(x),`pnorm(${x})`,8e-8);
for(const p of [.005,.025,.5,.975,.995])add(`normalQ(${p})`,M.normalQuantile(p),`qnorm(${p})`,3e-6);
for(const df of [3,4,10,30,99]){
 for(const x of [-5,-2,0,2,5])add(`tCDF(${x},${df})`,M.studentCDF(x,df),`pt(${x},${df})`);
 for(const p of [.025,.975])add(`tQ(${p},${df})`,M.studentQuantile(p,df),`qt(${p},${df})`);
 for(const p of [.025,.975])add(`chiQ(${p},${df})`,M.chiQuantile(p,df),`qchisq(${p},${df})`,1e-8);
}
for(const n of [1,10,60])for(const p of [0,.01,.5,.99,1]){let sum=0;for(let k=0;k<=n;k++){sum+=M.binomialPMF(k,n,p);add(`bin(${k},${n},${p})`,M.binomialPMF(k,n,p),`dbinom(${k},${n},${p})`)}if(Math.abs(sum-1)>1e-11)throw Error('Binomial mass');}
for(const a of [1,2,4])for(const b of [3,6,99])for(const x of [.01,1,27])add(`F(${x},${a},${b})`,M.fCDF(x,a,b),`pf(${x},${a},${b})`);
const rg=M.regression([1,3,4,5,7],[6,14,10,14,26]);add('OLS slope',rg.slope,'3');add('OLS SSE',rg.sse,'44');add('OLS R²',rg.r2,'180/224');const an=M.anova([[4,5,6],[7,8,9],[10,11,12]]);add('ANOVA F',an.f,'27');add('ANOVA P',an.p,'pf(27,2,6,lower.tail=FALSE)');
const script=`cat(sprintf('%.17g\\n',c(${cases.map(c=>c.r).join(',')})))`;
const refs=execFileSync(process.env.RSCRIPT || 'Rscript',['-e',script],{encoding:'utf8'}).trim().split(/\s+/).map(Number);
let max=0;const results=cases.map((c,i)=>{const error=Math.abs(c.got-refs[i]);max=Math.max(max,error);if(!Number.isFinite(c.got)||error>c.tol)throw Error(`${c.name}: ${c.got} vs ${refs[i]} err=${error}`);return {name:c.name,value:c.got,reference:refs[i],absoluteError:error,tolerance:c.tol}});
console.log(`${results.length} independent R-reference checks passed; max absolute error ${max}`);
