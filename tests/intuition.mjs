import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { intuitionState } from '../assets/intuition.mjs';
import { equationHTML } from '../assets/formulas.mjs';

const specs=JSON.parse(fs.readFileSync(new URL('../content/intuition.json',import.meta.url)));
const cases=specs.flatMap(s=>Array.from({length:Math.round((s.max-s.min)/s.step)+1},(_,i)=>({kind:s.kind,value:s.min+i*s.step})));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-intuition-'));
let count=0;
try {
  // Independent base-R fits and distribution functions, not browser formulas.
  const script=`options(warn=2)
cases <- read.csv("cases.csv")
for(i in seq_len(nrow(cases))) {
 k <- cases$kind[i]; v <- cases$value[i]
 if(k %in% c("spread","stability")) {
   y <- 10+(-2:2)*v; z <- c(mean(y),var(y),sd(y))
 } else if(k=="conditional") {
   rain <- seq_len(20)<=8; jam <- seq_len(20)<=6
   z <- sum(rain & jam)/sum(if(v==1) rain else rep(TRUE,20))
 } else if(k=="precision") {
   se <- 4/sqrt(v); z <- c(se,20+qnorm(c(.025,.975))*se)
 } else if(k=="pairing") {
   a <- c(8,10,12,14); b <- c(9,12,13,16)
   if(v==1) b <- rev(b)
   d <- b-a; z <- c(mean(d),sd(d),sd(d)/sqrt(length(d)))
 } else if(k=="anova") {
   group <- factor(rep(1:3,each=3)); y <- rep(c(10-v,10,10+v),each=3)+rep(-1:1,3)
   fit <- aov(y~group); a <- summary(fit)[[1]]
   z <- c(a[1,"Sum Sq"],a[2,"Sum Sq"],a[1,"F value"])
 } else if(k=="multiplicity") z <- 1-pbinom(0,size=v,prob=.05)
 else if(k=="interaction") {
   mu <- matrix(c(10,14,10,14+v),nrow=2,byrow=TRUE)
   z <- c(mu[1,2]-mu[1,1],mu[2,2]-mu[2,1],diff(mu[,2]-mu[,1]))
 } else if(k=="blocking") {
   trt <- factor(rep(1:3,2)); block <- factor(rep(1:2,each=3))
   y <- rep(c(10,12,14),2)+rep(c(-v,v),each=3)+c(-1,0,1,1,0,-1)
   fit <- lm(y~trt+block); omit <- lm(y~trt)
   z <- c(deviance(fit),df.residual(fit),deviance(fit)/df.residual(fit),deviance(omit)/df.residual(omit))
 } else if(k=="prediction") {
   d <- data.frame(x=c(1,3,4,5,7),y=c(6,14,10,14,26)); fit <- lm(y~x,data=d)
   z <- c(predict(fit,data.frame(x=v),interval="confidence"),predict(fit,data.frame(x=v),interval="prediction"))
 } else stop("unknown case")
 cat(paste(format(z,digits=17,scientific=TRUE,trim=TRUE),collapse=","),"\\n",sep="")
}`;
  fs.writeFileSync(path.join(temp,'cases.csv'),'kind,value\n'+cases.map(c=>`${c.kind},${c.value}`).join('\n'));
  fs.writeFileSync(path.join(temp,'reference.R'),script);
  const run=spawnSync('Rscript',['--vanilla','reference.R'],{cwd:temp,encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const reference=run.stdout.trim().split('\n').map(s=>s.split(',').map(Number));
  assert.equal(reference.length,cases.length);
  for(let i=0;i<cases.length;i++) {
    const c=cases[i], result=intuitionState(c.kind,c.value), m=result.metrics;
    const current=c.kind==='spread'||c.kind==='stability'?[m.mean,m.variance,m.sd]:c.kind==='conditional'?[m.probability]:c.kind==='precision'?[m.se,m.lower,m.upper]:c.kind==='pairing'?[m.mean,m.sd,m.se]:c.kind==='anova'?[m.sstrt,m.sse,m.f]:c.kind==='multiplicity'?[m.risk]:c.kind==='interaction'?[m.effectLow,m.effectHigh,m.interaction]:c.kind==='blocking'?[m.sse,m.dfError,m.mse,m.omitted]:[m.estimate,m.mean.lower,m.mean.upper,m.estimate,m.prediction.lower,m.prediction.upper];
    assert.equal(current.length,reference[i].length);
    current.forEach((v,j)=>assert.ok(Math.abs(v-reference[i][j])<1e-10*Math.max(1,Math.abs(v)),`${c.kind} ${c.value}: ${v} vs ${reference[i][j]}`));
    assert.doesNotMatch(result.svg,/NaN|Infinity|undefined/);
    assert.match(equationHTML(result.tex),/<math /);
    for(const match of result.svg.matchAll(/(?:cx|cy|x1|x2|y1|y2)="([^"]+)"/g)) assert.ok(Number.isFinite(Number(match[1])));
    count+=current.length;
  }
  assert.equal(intuitionState('precision',64).metrics.half/intuitionState('precision',4).metrics.half,.25);
  assert.ok(intuitionState('pairing',1).metrics.sd>intuitionState('pairing',0).metrics.sd);
  assert.equal(intuitionState('interaction',0).metrics.interaction,0);
  assert.equal(intuitionState('prediction',8).metrics.extrapolation,true);
  assert.throws(()=>intuitionState('bad',1));
  console.log(`${cases.length} story states (${count} values) match independent R; all changing LaTeX and SVG coordinates are valid.`);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
