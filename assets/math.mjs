// Numerical functions for educational simulations; normal CDF uses Abramowitz-Stegun approximation.
export const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export const variance=a=>a.length>1?a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1):NaN;
export function median(a){const b=[...a].sort((x,y)=>x-y),i=Math.floor(b.length/2);return b.length%2?b[i]:(b[i-1]+b[i])/2}
export function quantile(a,p){const b=[...a].sort((x,y)=>x-y),h=(b.length-1)*p,i=Math.floor(h);return b[i]+(b[Math.min(i+1,b.length-1)]-b[i])*(h-i)}
export function normalCDF(x){if(x===Infinity)return 1;if(x===-Infinity)return 0;const z=Math.abs(x),t=1/(1+.2316419*z),d=Math.exp(-z*z/2)/Math.sqrt(2*Math.PI);const p=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p}
export const normalPDF=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
export function invert(cdf,p,lo,hi){if(!(p>0&&p<1))throw Error('Probability must be between 0 and 1');for(let i=0;i<85;i++){const mid=(lo+hi)/2;if(cdf(mid)<p)lo=mid;else hi=mid}return (lo+hi)/2}
export const normalQuantile=p=>invert(normalCDF,p,-10,10);
export function logGamma(z){const c=[676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];if(z<.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);z--;let x=.99999999999980993;for(let i=0;i<c.length;i++)x+=c[i]/(z+i+1);const t=z+7.5;return .5*Math.log(2*Math.PI)+(z+.5)*Math.log(t)-t+Math.log(x)}
function betaCF(a,b,x){const eps=3e-14,min=1e-300;let c=1,d=1-(a+b)*x/(a+1);if(Math.abs(d)<min)d=min;d=1/d;let h=d;for(let m=1;m<=300;m++){let aa=m*(b-m)*x/((a+2*m-1)*(a+2*m));d=1+aa*d;if(Math.abs(d)<min)d=min;c=1+aa/c;if(Math.abs(c)<min)c=min;d=1/d;h*=d*c;aa=-(a+m)*(a+b+m)*x/((a+2*m)*(a+2*m+1));d=1+aa*d;if(Math.abs(d)<min)d=min;c=1+aa/c;if(Math.abs(c)<min)c=min;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<eps)break}return h}
export function betaCDF(x,a,b){if(x<=0)return 0;if(x>=1)return 1;const f=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));return x<(a+1)/(a+b+2)?f*betaCF(a,b,x)/a:1-f*betaCF(b,a,1-x)/b}
export function studentCDF(t,df){if(t===0)return .5;const p=.5*betaCDF(df/(df+t*t),df/2,.5);return t>0?1-p:p}
export const studentQuantile=(p,df)=>invert(t=>studentCDF(t,df),p,-10000,10000);
export function gammaCDF(x,a){if(x<=0)return 0;const f=Math.exp(a*Math.log(x)-x-logGamma(a));if(x<a+1){let s=1/a,d=s;for(let n=1;n<1000;n++){d*=x/(a+n);s+=d;if(Math.abs(d)<Math.abs(s)*1e-14)break}return Math.min(1,s*f)}let b=x+1-a,c=1e300,d=1/b,h=d;for(let i=1;i<1000;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-300)d=1e-300;c=b+an/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const del=d*c;h*=del;if(Math.abs(del-1)<1e-14)break}return Math.max(0,1-f*h)}
export const chiCDF=(x,df)=>gammaCDF(x/2,df/2);
export const chiQuantile=(p,df)=>invert(x=>chiCDF(x,df),p,0,Math.max(100,df*10));
export const chiPDF=(x,df)=>x>0?Math.exp((df/2-1)*Math.log(x)-x/2-df/2*Math.log(2)-logGamma(df/2)):0;
export const fCDF=(x,a,b)=>x<=0?0:betaCDF(a*x/(a*x+b),a/2,b/2);
export function binomialPMF(k,n,p){if(k<0||k>n)return 0;if(p===0)return k===0?1:0;if(p===1)return k===n?1:0;return Math.exp(logGamma(n+1)-logGamma(k+1)-logGamma(n-k+1)+k*Math.log(p)+(n-k)*Math.log1p(-p))}
export function regression(x,y){const n=x.length,xb=mean(x),yb=mean(y),sxx=x.reduce((s,v)=>s+(v-xb)**2,0),sxy=x.reduce((s,v,i)=>s+(v-xb)*(y[i]-yb),0),syy=y.reduce((s,v)=>s+(v-yb)**2,0);const slope=sxy/sxx,intercept=yb-slope*xb,pred=x.map(v=>intercept+slope*v),sse=y.reduce((s,v,i)=>s+(v-pred[i])**2,0);return {n,xb,yb,sxx,sxy,syy,slope,intercept,pred,sse,ssr:syy-sse,mse:sse/(n-2),r:sxy/Math.sqrt(sxx*syy),r2:1-sse/syy}}
export function anova(groups){const all=groups.flat(),gm=mean(all),means=groups.map(mean),ssb=groups.reduce((s,g,i)=>s+g.length*(means[i]-gm)**2,0),sse=groups.reduce((s,g,i)=>s+g.reduce((a,v)=>a+(v-means[i])**2,0),0),dft=groups.length-1,dfe=all.length-groups.length,mse=sse/dfe,f=(ssb/dft)/mse;return {gm,means,ssb,sse,sst:ssb+sse,dft,dfe,mse,f,p:1-fCDF(f,dft,dfe)}}
export function seeded(seed=440){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return (seed+.5)/4294967296}}
export function randomNormal(rng){return Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng())}
