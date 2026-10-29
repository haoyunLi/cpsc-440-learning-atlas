import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { contrastSummary, contrastCovariance, contrastRCode, parseCoefficient } from '../assets/contrast.mjs';

const base = { means:[10,12,14,16],sizes:[4,4,4,4],weights:[1,-1/3,-1/3,-1/3],mse:4,alpha:.05,family:4,method:'individual' };
const near = (a,b,tolerance=1e-9) => assert.ok(Math.abs(a-b)<tolerance, `${a} versus ${b}`);
// Independent R 4.4.1 qt/pt/qf/pf values, using the displayed common-MSE model.
const references = {
  individual:{critical:2.1788128296672284,adjustedP:.0046816047531641,low:-6.515876347444369,high:-1.48412365255563},
  bonferroni:{critical:2.9344589209476202,adjustedP:.0187264190126565,low:-7.388421295870014,high:-.6115787041299843},
  scheffe:{critical:3.235874604877762,adjustedP:.034590357155647,low:-7.736466148380099,high:-.2635338516198988}
};
for(const [method, expected] of Object.entries(references)) {
  const config={...base,method}, r=contrastSummary(config);
  for(const [key,value] of Object.entries(expected))near(r[key],value);
  near(r.estimate,-4); near(r.se,1.1547005383792517);near(r.t,-3.4641016151377535);near(r.rawP,.0046816047531641);
  assert.equal(r.isContrast,true);assert.equal(r.weightSum,0);near(r.ss,48);assert.equal(r.df,12);
  for(const scale of [-1,3]) {
    const scaled=contrastSummary({...config,weights:base.weights.map(x=>x*scale)});
    near(scaled.estimate,r.estimate*scale);near(scaled.se,r.se*Math.abs(scale));near(scaled.rawP,r.rawP);near(scaled.adjustedP,r.adjustedP);near(scaled.ss,r.ss);
  }
  const shifted=contrastSummary({...config,means:base.means.map(x=>x+10)});near(shifted.estimate,r.estimate);near(shifted.se,r.se);
}
const unequal={...base,sizes:[4,8,4,4]}, r=contrastSummary(unequal);
near(r.se,1.1303883305208782);near(r.rawP,.0027314660343432);near(r.low,-6.396316212049076);near(r.high,-1.603683787950923);
const cov=contrastCovariance(base.weights,[0,1,-1,0],unequal.sizes,4);near(cov.covariance,1/6);near(cov.correlation,.1203858530857692);
near(contrastCovariance(base.weights,[0,1,-1,0],base.sizes,4).inner,0);
const average={...base,weights:[0,1/3,1/3,1/3]};assert.equal(contrastSummary(average).isContrast,false);assert.equal(contrastSummary(average).ss,null);
near(contrastSummary({...average,means:base.means.map(x=>x+10)}).estimate,contrastSummary(average).estimate+10);
assert.throws(()=>contrastSummary({...average,method:'scheffe'}),/Scheffé/);
for(const config of [{...base,weights:[0,0,0,0]},{...base,sizes:[4,0,4,4]},{...base,sizes:[4,3.5,4,4]},{...base,mse:0},{...base,means:[10,NaN,12,14]},{...base,family:0}])assert.throws(()=>contrastSummary(config));
for(const text of ['','NaN','Infinity','1/0','2/3/4','1;2','0x20'])assert.throws(()=>parseCoefficient(text));
near(parseCoefficient('−1/3'),-1/3);near(parseCoefficient(' 2 / 3 '),2/3);near(parseCoefficient('-.5'),-.5);
// Every UI-generated R program must run by itself and reproduce its displayed result.
for(const config of [...Object.keys(references).map(method=>({...base,method})),average,unequal]){
  const program='options(warn=2)\n'+contrastRCode(config)+'\ncat("CHECK",L,SE,df,t_value,p_raw,p_adjusted,sep="|")';
  const process=spawnSync('Rscript',['--vanilla','-e',program],{encoding:'utf8',timeout:30000});
  assert.equal(process.status,0,process.stderr||process.error?.message);assert.equal(process.stderr,'');
  const row=process.stdout.split('CHECK|')[1].split('|').map(Number), js=contrastSummary(config);
  [js.estimate,js.se,js.df,js.t,js.rawP,js.adjustedP].forEach((v,i)=>near(row[i],v,1e-5));
}
console.log('Contrast inference matches R; family scope, scale/shift invariants, unequal-n covariance, invalid input and standalone generated R passed.');
