import * as M from './math.mjs';
import { parseSample } from './sample.mjs';
import { mountSearch } from './search.mjs';
import { mountLatinDesigner } from './latin.mjs';
import { boxplotAnalysis, drawBoxplot, boxplotRCode } from './boxplot.mjs';
import { mountCLT } from './clt.mjs';
import { mountBinomial, chapterProbabilityLabel as binomialProbabilityLabel, binomialTailSummary as summarizeBinomialTail } from './binomial.mjs';
import { mountFactorial } from './factorial.mjs';
import { mountPaired } from './paired.mjs';
import { mountAnova } from './anova.mjs';
const readingChapterIds = ['01', '04', '05', '06', '07', '08', '09', '14', '15', '11'];
export function normalizeReadingProgress(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && readingChapterIds.includes(id)))] : [];
}
const $=(s,r=document)=>r.querySelector(s);const fmt=(x,d=3)=>Number.isFinite(x)?x.toFixed(d):'—';const ns='http://www.w3.org/2000/svg';
function svg(label){return `<svg viewBox="0 0 680 320" role="img" aria-label="${label}"></svg>`}
function tag(type,attrs={},text=''){const n=document.createElementNS(ns,type);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;return n}
function add(s,type,a,t){const n=tag(type,a,t);s.append(n);return n}
function axes(s,xlabel,ylabel,xmin,xmax,ymin=0,ymax=1,xTickFormat=v=>fmt(v,1),yTickFormat=null){s.replaceChildren();const x=v=>85+(v-xmin)/(xmax-xmin)*550,y=v=>265-(v-ymin)/(ymax-ymin)*220;add(s,'line',{x1:85,y1:265,x2:635,y2:265,class:'plot-axis'});add(s,'line',{x1:85,y1:45,x2:85,y2:265,class:'plot-axis'});for(let i=0;i<=4;i++){const xx=xmin+(xmax-xmin)*i/4,yy=ymin+(ymax-ymin)*i/4;add(s,'text',{x:x(xx),y:288,'text-anchor':'middle',class:'plot-muted'},xTickFormat(xx));add(s,'line',{x1:80,x2:85,y1:y(yy),y2:y(yy),class:'plot-axis'});add(s,'text',{x:75,y:y(yy)+5,'text-anchor':'end',class:'plot-muted'},yTickFormat?yTickFormat(yy,(ymax-ymin)/4):fmt(yy,ymax-ymin<1?2:1))}add(s,'text',{x:350,y:316,'text-anchor':'middle',class:'plot-label'},xlabel);add(s,'text',{x:85,y:22,class:'plot-label'},ylabel);return {x,y}}
function curve(s,fn,xmin,xmax,map,cl='plot-line'){let d='';for(let i=0;i<=180;i++){const v=xmin+(xmax-xmin)*i/180;d+=(i?' L':'M')+map.x(v)+','+map.y(fn(v))}add(s,'path',{d,class:cl})}
function area(s,fn,a,b,map,color='#b9d9cc'){if(b<=a)return;let d=`M${map.x(a)},${map.y(0)}`;for(let i=0;i<=90;i++){const v=a+(b-a)*i/90;d+=` L${map.x(v)},${map.y(fn(v))}`}d+=` L${map.x(b)},${map.y(0)} Z`;add(s,'path',{d,fill:color,opacity:.7})}
function range(id,label,min,max,step,value){return `<label for="${id}">${label} <output id="${id}-v">${value}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`}
// Keep nested modules out of this lab's output updates.
function setup(el,html,fn){el.innerHTML=html;const ownedRanges=[...el.querySelectorAll('input[type=range]')];const update=()=>{ownedRanges.forEach(i=>{$('#'+i.id+'-v',el).textContent=i.value});fn()};el.querySelectorAll('input,select,textarea').forEach(i=>i.addEventListener('input',update));update();return update}
function val(id,el){return Number($('#'+id,el).value)}
export function chapterProbabilityLabel(value, complement = 1 - value, digits = 6) {
  return binomialProbabilityLabel(value, complement, digits);
}
export function binomialTailSummary(n, p, k) {
  return summarizeBinomialTail(n, p, k);
}
export function formatSummaryNumber(value, spread = Math.abs(value)) {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  if (!(spread > 0)) return String(value);
  // Do not present cancellation noise (for example a theoretically zero fence)
  // as eight trustworthy significant digits. Exact zero remains distinct.
  if (Math.abs(value) < 16 * Number.EPSILON * spread) return '≈0';
  const digits = Math.min(17, Math.max(8, Math.floor(Math.log10(Math.abs(value))) - Math.floor(Math.log10(spread)) + 6));
  return Number(value.toPrecision(digits)).toString();
}
export function formatSummaryTick(value, span) {
  return Math.abs(value) < Math.abs(span) * 1e-12 ? '0' : Number(value.toPrecision(5)).toString();
}
function summaryMomentText(value, log10) {
  if (value === 0 && Number.isFinite(log10)) {
    const exponent = Math.floor(log10);
    return `${formatSummaryNumber(10 ** (log10 - exponent))}e${exponent}`;
  }
  return formatSummaryNumber(value);
}
export function summaryAnalysis(values, bins = 7) {
  if (values.length < 2 || values.length > 500 || values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e10) || !Number.isInteger(bins) || bins < 3 || bins > 20) throw Error('请输入 2–500 个有效观测与 3–20 个 bins。');
  const min = Math.min(...values), max = Math.max(...values), spread = max - min;
  // Center and scale before taking moments. Identical decimals then have
  // exactly zero variance, while small changes around a large offset survive.
  const scaled = spread ? values.map(v => (v - min) / spread) : values.map(() => 0);
  const center = M.mean(scaled), scaledVariance = scaled.reduce((s, v) => s + (v - center) ** 2, 0) / (values.length - 1);
  const mean = spread ? min + center * spread : min, sd = Math.sqrt(scaledVariance) * spread, variance = sd * sd;
  const logVariance = spread && scaledVariance ? Math.log10(scaledVariance) + 2 * Math.log10(spread) : -Infinity;
  const q1 = M.quantile(values, .25), q3 = M.quantile(values, .75), iqr = q3 - q1;
  const padding = spread ? 0 : Math.max(Math.abs(min) * .1, min === 0 ? 1 : Number.MIN_VALUE);
  const lo = min - padding, hi = max + padding, span = hi - lo;
  const counts = Array(bins).fill(0);
  values.forEach(v => counts[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / span * bins)))]++);
  const offset = Math.abs(lo) / span >= 1000 ? lo : 0;
  const magnitude = Math.max(Math.abs(lo - offset), Math.abs(hi - offset));
  const exponent = magnitude >= 1e5 || magnitude < 1 ? Math.max(-323, Math.floor(Math.log10(magnitude))) : 0;
  const unit = 10 ** exponent, start = (lo - offset) / unit, end = (hi - offset) / unit;
  const axis = { start, end, offset, exponent, label: offset ? 'Y 的局部刻度（见图下基准）' : exponent ? `Y（刻度 × 1e${exponent}）` : 'Y（测量值）' };
  const scaleNote = offset ? `横轴实际测量值 Y = ${String(offset)} + 刻度${exponent ? ` × 1e${exponent}` : ''}。基准平移只用于显示，统计量仍使用原始数据。` : exponent ? `横轴刻度需乘以 1e${exponent}，才是原始测量值；数据与统计量没有改变单位。` : '';
  return { n: values.length, mean, median: M.median(values), variance, sd, iqr, fences: [q1 - 1.5 * iqr, q3 + 1.5 * iqr], spread, counts, axis, scaleNote,
    meanPosition: start + (mean - lo) / span * (end - start), varianceText: summaryMomentText(variance, logVariance), sdText: summaryMomentText(sd, logVariance / 2) };
}
export function inferenceProbabilities({ n, sigma, delta, alpha, tail }) {
  if (![n, sigma, delta, alpha].every(Number.isFinite) || n < 1 || sigma <= 0 || alpha <= 0 || alpha >= .5 || !['right', 'left', 'two'].includes(tail)) throw Error('无效的 z 检验设置。');
  const se = sigma / Math.sqrt(n), z = M.normalQuantile(1 - alpha / (tail === 'two' ? 2 : 1));
  const lower = tail === 'right' ? -Infinity : -z * se, upper = tail === 'left' ? Infinity : z * se;
  const nonRejection = M.normalCDF((upper - delta) / se) - M.normalCDF((lower - delta) / se), rejection = 1 - nonRejection;
  const inAlternative = tail === 'right' ? delta > 0 : tail === 'left' ? delta < 0 : delta !== 0;
  const classification = inAlternative ? 'alternative' : delta === 0 ? 'boundary' : 'null';
  return { se, lower, upper, nonRejection, rejection, classification, beta: inAlternative ? nonRejection : null, power: inAlternative ? rejection : null };
}
const instructions={summary:['数据摘要实验室','改变数据或 bin 数，追踪每个点如何改变 center 与 spread。'],probability:['Binomial 与 CLT 实验室','每一根柱是某个 count 的 probability；再亲自反复抽样观察 mean 的分布。'],inference:['Type I、Type II 与 power 实验室','先固定 rejection rule，再看指定真实均值下的拒绝与不拒绝概率。'],paired:['Pairing 的信息在哪里？','保留观测身份，比较整行排序与单列重排，追踪 difference、covariance 与 SE。'],variance:['χ² 与 variance CI 实验室','df 改变 reference distribution，并改变 variance interval 的不对称性。'],anova:['从一个观测走到 ANOVA 表','用正文同一份九点数据，逐项核对有方向的偏差、交叉项与平方和。'],multiple:['Multiple-testing 实验室','这里的 FWER 公式明确假定 independent null tests；Bonferroni bound 不需要独立。'],factorial:['Interaction 与不同权重的 marginal means','先改变 cell means，再保持它们不变只改样本数，区分条件效应与样本构成。'],design:['Blocking 与 Latin square 实验室','沿光照梯度，比较各 treatment 在每个 block 中均出现的结构。'],regression:['Least-squares 与 prediction 实验室','改变一个 observation，并比较逐点 mean CI 与 new-observation PI。']};
function labSummary(el) {
  const update=setup(el, `<label for="data-values">原创示例数据；逗号或空格分隔，至少 2 个数，最多 500 个</label><textarea id="data-values">2, 3, 3, 4, 18</textarea><div class="controls">${range('bins','Bins',3,20,1,7)}</div><p class="error" role="alert"></p>${svg('示例数据 histogram 与统计量')}<p class="caption" data-summary-scale></p><div class="readout" aria-live="polite"></div><p class="caption">Histogram 纵轴为 count。改变 bins 只改分组显示，不改观测或统计量。所有观测相同时，SD 与 variance 为 0；图中会留出横轴空间显示这一根柱。≈0 表示计算结果接近本组数据尺度的浮点舍入精度。</p>
    <h3>同一组数据：箱体、须和围栏分别在哪里？</h3><p>先预测：把最后一个值移远时，mean 与 median 谁更敏感？须会伸到围栏，还是围栏内最远的实际观测？下方与 histogram 使用同一组数据；两个图各自缩放并标明刻度。</p>
    <label for="box-rule">箱体规则<select id="box-rule"><option value="type7">R type 7（线性插值）</option><option value="hinges">Tukey hinges（R 箱线图）</option></select></label>
    <div class="lab-actions"><button type="button" id="box-example" class="secondary">载入规则差异例 [2,3,4,12]</button><button type="button" id="summary-reset" class="secondary">恢复初始数据</button></div>
    <div data-box-plot>${svg('同一组数据的箱线图、实际须端点、内围栏与原始观测；异常候选为空心点')}</div><p class="caption" data-box-scale></p><div data-box-result class="readout" aria-live="polite"></div>
    <p class="caption">实线短竖线是须端点；棕色虚线是 1.5×IQR 内围栏，围栏不一定是观测值。下方每点保留一条原始观测：实心点在围栏内，空心点为异常值候选；相同数值竖向错开，超过 5 个时仍会重叠，纵向位置不代表另一变量。恰好在围栏上的点仍在范围内。候选标签不是删除指令。</p>
    <details><summary>规则为何可能改变箱体和异常候选？</summary><p>Type 7 对 p 分位数取排序位置 h=1+(n−1)p，在相邻观测间线性插值。Tukey hinges 分别取排序数据下半部与上半部的中位数，奇数 n 时把总中位数包含在两半中；这是 R 的 boxplot 使用的规则。median 与原始数据并未因选择规则而改变。</p><p>先载入 [2,3,4,12]：type 7 的 Q1=2.75、Q3=6，上围栏=10.875，因此 12 被标出；Tukey 的下/上 hinge=2.5、8，上围栏=16.25，因此须可伸到 12。两种计算目标规则不同，不能只凭标记不同认定软件算错。课程或题目指定规则时，应按该规则报告。</p><p><a href="#boxplot">回到逐步箱线图讲解</a> · <a href="https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/boxplot.stats.html" target="_blank" rel="noopener noreferrer">R 官方：hinges 与 whiskers</a></p></details>
    <details><summary>用当前数据与规则在 R 中复算</summary><button type="button" id="box-copy" class="secondary">复制当前 R 代码</button><pre data-box-code></pre><p data-box-copy-status class="status" role="status"></p></details>`, () => {
    const err = $('.error',el), scaleNote = $('[data-summary-scale]',el);
    let r, box, values;
    try { values=parseSample($('textarea',el).value, {maxAbs:1e10}); r=summaryAnalysis(values,val('bins',el)); box=boxplotAnalysis(values,$('#box-rule',el).value); }
    catch(error) { err.textContent=error.message; el.querySelectorAll('svg').forEach(s=>s.replaceChildren()); $('.readout',el).textContent='等待有效数据'; scaleNote.textContent=''; $('[data-box-result]',el).textContent='等待有效数据'; $('[data-box-scale]',el).textContent=''; $('[data-box-code]',el).textContent=''; $('#box-copy',el).disabled=true; $('[data-box-copy-status]',el).textContent=''; return; }
    err.textContent=''; scaleNote.textContent=r.scaleNote;
    const s=$('svg',el), axis=r.axis, axisSpan=axis.end-axis.start;
    const map=axes(s,axis.label,'Frequency（count）',axis.start,axis.end,0,Math.max(...r.counts)*1.2,v=>formatSummaryTick(v,axisSpan));
    r.counts.forEach((v,i)=>add(s,'rect',{x:map.x(axis.start+i*axisSpan/r.counts.length)+1,y:map.y(v),width:550/r.counts.length-2,height:map.y(0)-map.y(v),fill:'#086f68'}));
    add(s,'line',{x1:map.x(r.meanPosition),x2:map.x(r.meanPosition),y1:40,y2:265,stroke:'#9a472e','stroke-dasharray':'6 4'});
    add(s,'text',{x:map.x(r.meanPosition),y:36,'text-anchor':'middle',class:'plot-label'},'Mean');
    const centerText=value=>formatSummaryNumber(value,r.spread);
    $('.readout',el).textContent=`n=${r.n} · mean=${centerText(r.mean)} · median=${centerText(box.median)} · s²=${r.varianceText} · SD=${r.sdText}`;
    drawBoxplot($('[data-box-plot] svg',el),box,formatSummaryTick);
    $('[data-box-scale]',el).textContent=box.scaleNote+' 本图包含全部观测和围栏；横轴范围可能与 histogram 不同。';
    $('[data-box-result]',el).textContent=`${box.convention==='type7'?'R type 7':'Tukey hinges'} · 下/上箱边=[${[box.q1,box.q3].map(centerText).join(', ')}] · median=${centerText(box.median)} · IQR=${formatSummaryNumber(box.iqr)} · 内围栏=[${box.fences.map(centerText).join(', ')}] · 实际须端点=[${box.whiskers.map(centerText).join(', ')}] · 异常候选 ${box.outliers.length}/${box.n}${box.outliers.length?`：${box.outliers.slice(0,12).map(centerText).join(', ')}${box.outliers.length>12?'…（仅列前12个）':''}`:'。'}`;
    $('[data-box-code]',el).textContent=boxplotRCode(values,box.convention); $('#box-copy',el).disabled=false; $('[data-box-copy-status]',el).textContent='';
  });
  $('#box-example',el).onclick=()=>{$('textarea',el).value='2, 3, 4, 12';$('#box-rule',el).value='type7';update();};
  $('#summary-reset',el).onclick=()=>{$('textarea',el).value='2, 3, 3, 4, 18';$('#box-rule',el).value='type7';$('#bins',el).value='7';update();};
  $('#box-copy',el).onclick=async()=>{try{await navigator.clipboard.writeText($('[data-box-code]',el).textContent);$('[data-box-copy-status]',el).textContent='已复制当前数据与规则的 R 代码。';}catch{$('[data-box-copy-status]',el).textContent='请选中上方完整代码复制。';}};
}
function labProbability(el) {
  el.innerHTML = '<div data-binomial></div><div data-clt></div>';
  mountBinomial(el.querySelector('[data-binomial]'));
  mountCLT(el.querySelector('[data-clt]'));
}
function labInference(el){const update=setup(el,`<div class="controls">${range('in','n',4,200,1,25)}${range('is','Known σ',1,20,.5,10)}${range('id','True μ−μ₀',-8,8,.25,4)}${range('ia','α',.01,.2,.01,.05)}<label for="tail">Alternative<select id="tail"><option value="right">Right-tail: μ&gt;0</option><option value="left">Left-tail: μ&lt;0</option><option value="two">Two-tail: μ≠0</option></select></label></div>${svg('Null 边界与指定真实均值的 sample-mean densities，标出拒绝与不拒绝区域')}<div class="readout" aria-live="polite"></div><p class="caption inference-caption"></p><h3>双侧已知 σ CI 的重复覆盖</h3><p>本段独立演示：从 Normal(0,σ²) 抽样，始终构造双侧区间 ȳ ± z₁₋α/₂σ/√n。真实均值固定为 0；区间使用上方 n、σ 与 α，但不随备择方向改变。每条横线是新 sample 的 CI；实线覆盖 μ=0，虚线未覆盖。图示最新 24 条区间，覆盖率按当前保留的最多 1000 条计算。横轴通常保持 ±5SE；需要时会扩展并留白，显示最新区间的完整端点。</p><p class="caption ci-relation">同一数据、模型与 α 下，双侧检验拒绝 H₀: μ=μ₀，对应双侧 CI 不含 μ₀。单侧检验应对照同置信度的单侧界限，不能直接对照这里的双侧区间。<a href="#testing">查看单侧与双侧检验的拒绝域 →</a></p><div class="lab-actions"><button id="ci-step">生成 1 个 interval</button><button id="ci-play" class="secondary">播放 50 个 intervals</button><button id="ci-reset" class="secondary">重置</button></div><div id="ci-plot">${svg('双侧已知σ置信区间的重复覆盖；纵线是固定的μ=0，不随上方备择方向改变')}</div><p id="ci-readout" class="readout" aria-live="polite">尚未生成 intervals</p>`,()=>{const n=val('in',el),sigma=val('is',el),delta=val('id',el),alpha=val('ia',el),tail=$('#tail',el).value,result=inferenceProbabilities({n,sigma,delta,alpha,tail}),{se,lower,upper}=result;const lo=Math.min(-4*se,delta-4*se),hi=Math.max(4*se,delta+4*se),s=$('svg',el),map=axes(s,'Sample mean ȳ（μ₀=0）','Density',lo,hi,0,.46/se);const nul=v=>M.normalPDF(v/se)/se,alt=v=>M.normalPDF((v-delta)/se)/se;if(lower!==-Infinity)area(s,nul,lo,lower,map);if(upper!==Infinity)area(s,nul,upper,hi,map);area(s,alt,Math.max(lo,lower),Math.min(hi,upper),map,'#dfbba9');curve(s,nul,lo,hi,map);curve(s,alt,lo,hi,map,'plot-alt');[lower,upper].filter(Number.isFinite).forEach(c=>add(s,'line',{x1:map.x(c),x2:map.x(c),y1:45,y2:265,stroke:'#50655f','stroke-dasharray':'3 3'}));const probabilityText=result.classification==='alternative'?`β(μₐ=${delta})=${fmt(result.beta,4)} · power=${fmt(result.power,4)}`:result.classification==='boundary'?`真值 μ=μ₀：P(拒绝 H₀)=α=${fmt(result.rejection,4)} · P(不拒绝 H₀)=${fmt(result.nonRejection,4)}`:`真值 μ=${delta} 属于 H₀：P(拒绝 H₀)=${fmt(result.rejection,4)} · P(不拒绝 H₀)=${fmt(result.nonRejection,4)}`;$('.readout',el).textContent=`SE=${fmt(se)} · critical ȳ=${tail==='right'?fmt(upper):tail==='left'?fmt(lower):`${fmt(lower)}, ${fmt(upper)}`} · ${probabilityText}`;$('.inference-caption',el).textContent=`实线为 null 边界 μ₀=0，绿色区域是该边界的拒绝概率 α；虚线为指定真值 μ=${delta}，brown 区域是该真值下不拒绝的概率。${result.classification==='alternative'?'该真值满足 Hₐ，因此 brown 面积称为 β，拒绝概率称为 power。':'该真值满足 H₀，不属于本次 Hₐ，因此不把 brown 面积标为 Type II error β；这里报告拒绝与不拒绝概率。'}Known σ 的 z model。`});let rng=M.seeded(440),records=[],timer=null;const play=$('#ci-play',el);function stop(){if(timer)clearInterval(timer);timer=null;play.textContent='播放 50 个 intervals'}function reset(){stop();records=[];rng=M.seeded(440);$('#ci-plot svg',el).replaceChildren();$('#ci-readout',el).textContent='尚未生成 intervals'}function step(){const se=val('is',el)/Math.sqrt(val('in',el)),z=M.normalQuantile(1-val('ia',el)/2),m=M.randomNormal(rng)*se;records.push({m,lo:m-z*se,hi:m+z*se,hit:Math.abs(m)<=z*se});if(records.length>1000)records.shift();const shown=records.slice(-24),padding=.25*se,xmin=Math.min(-5*se,...shown.map(r=>r.lo-padding)),xmax=Math.max(5*se,...shown.map(r=>r.hi+padding)),s=$('#ci-plot svg',el),map=axes(s,'双侧 CI endpoints（known σ）','最新 24 个 sample intervals',xmin,xmax,0,25);add(s,'line',{x1:map.x(0),x2:map.x(0),y1:40,y2:265,stroke:'#50655f'});shown.forEach((r,i)=>{add(s,'line',{x1:map.x(r.lo),x2:map.x(r.hi),y1:map.y(i+1),y2:map.y(i+1),stroke:r.hit?'#086f68':'#9a472e','stroke-width':2,'stroke-dasharray':r.hit?'':'4 3'});add(s,'circle',{cx:map.x(r.m),cy:map.y(i+1),r:2,fill:'#183a37'})});const hits=records.filter(r=>r.hit).length;$('#ci-readout',el).textContent=`${hits}/${records.length} intervals 覆盖 μ=0；observed coverage=${fmt(hits/records.length,3)}，双侧标称覆盖率=${fmt(1-val('ia',el),2)}。有限模拟不会总是恰好达到 nominal rate。`}
$('#ci-step',el).onclick=()=>{stop();step()};$('#ci-reset',el).onclick=reset;play.onclick=()=>{if(timer){stop();return}let left=50;play.textContent='暂停';timer=setInterval(()=>{step();if(--left===0)stop()},250)};el.querySelectorAll('.controls input').forEach(i=>i.addEventListener('input',reset));document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});window.addEventListener('pagehide',stop)}
function labPaired(el){mountPaired(el)}
function labVariance(el){setup(el,`<div class="controls">${range('vn','n（normal sample）',4,100,1,10)}${range('vs','Observed s²',.5,16,.5,4)}</div>${svg('χ² reference density 与 95% central interval')}<div class="readout" aria-live="polite"></div><p class="caption">示例观测 summaries，独立 normal population 假设。曲线横轴是 χ² pivot，并非原始 Y 或 variance。</p>`,()=>{const df=val('vn',el)-1,v=val('vs',el),lo=M.chiQuantile(.025,df),hi=M.chiQuantile(.975,df),xmax=M.chiQuantile(.999,df),max=M.chiPDF(Math.max(.1,df-2),df),s=$('svg',el),map=axes(s,'χ² pivot Q=(n−1)s²/σ²','Density',0,xmax,0,max*1.2,undefined,(value,step)=>String(Number(value.toFixed(Math.max(0,1-Math.floor(Math.log10(step)))))));area(s,x=>M.chiPDF(x,df),lo,hi,map);curve(s,x=>M.chiPDF(x,df),.01,xmax,map);$('.readout',el).textContent=`df=${df} · χ²(.025)=${fmt(lo)} · χ²(.975)=${fmt(hi)} · 95% σ² CI=[${fmt(df*v/hi)},${fmt(df*v/lo)}] · σ CI=[${fmt(Math.sqrt(df*v/hi))},${fmt(Math.sqrt(df*v/lo))}]`})}
function labAnova(el){mountAnova(el)}
function labMultiple(el){setup(el,`<div class="controls">${range('mm','m null tests',1,100,1,20)}${range('ma','Per-test α',.01,.1,.005,.05)}</div>${svg('Independent null tests 的 familywise error 随 m 增加')}<div class="readout" aria-live="polite"></div><p class="caption">模拟理论场景：tests independent 且所有 null 为真。实线为未校正 FWER，虚线是 Bonferroni bound 对固定 family target。</p>`,()=>{const m=val('mm',el),a=val('ma',el),s=$('svg',el),map=axes(s,'Number of null tests m','FWER probability',1,100,0,1);curve(s,x=>1-(1-a)**x,1,100,map);add(s,'line',{x1:55,x2:645,y1:map.y(a),y2:map.y(a),stroke:'#9a472e','stroke-dasharray':'6 4'});add(s,'circle',{cx:map.x(m),cy:map.y(1-(1-a)**m),r:6,fill:'#9a472e'});$('.readout',el).textContent=`未校正 FWER=1−(1−${a})^${m}=${fmt(1-(1-a)**m,4)} · 若 family target=${a}，Bonferroni per-test threshold=${fmt(a/m,6)}，independent case corrected FWER=${fmt(1-(1-a/m)**m,4)} ≤ target。`})}
function labFactorial(el){mountFactorial(el)}
function labDesign(el){let seed=440;setup(el,`<div class="controls">${range('dg','Light-gradient strength',0,10,.5,5)}</div>${svg('RCBD 每个 block 包含三个 treatment，光照在 blocks 之间变化')}<div class="readout" aria-live="polite"></div><div class="lab-actions"><button id="randomize">重新 randomize（seed +1）</button></div><h3>自己构建一个 4×4 Latin square</h3><div id="latin"></div><p class="caption">上方 RCBD 图的 letters 是 treatments。其重新 randomize 按钮只在 block 内排列，保持 RCBD 的约束；Latin square 任务有自己独立的编辑与置换按钮。背景深浅编码光照；固定 residuals 在每个 treatment 和 block 内的和均为 0，因此 SSE 的变化可直接追踪到 block term。这是设计演示，不是实测数据。下方 one-way 数值是对同一 RCBD 汇总省略 block 后的分析，不能把既有抽签方案改成 CRD；真正的 CRD 在所有实验单位之间随机分配处理。</p>`,()=>draw());function draw(){const s=$('svg',el),gradient=val('dg',el),rng=M.seeded(seed);s.replaceChildren();let arrangements=[];for(let block=0;block<5;block++){const perm=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(rng()*(i+1));[perm[i],perm[j]]=[perm[j],perm[i]]}arrangements.push(perm);add(s,'rect',{x:48+block*115,y:46,width:110,height:204,fill:'#183a37',opacity:(gradient/10)*(4-block)/16});add(s,'text',{x:100+block*115,y:30,'text-anchor':'middle',class:'plot-label'},'Block '+(block+1));perm.forEach((t,row)=>{add(s,'rect',{x:55+block*115,y:60+row*62,width:95,height:50,fill:['#dcebe4','#c5ded3','#adcdbf'][t]});add(s,'text',{x:102+block*115,y:92+row*62,'text-anchor':'middle',class:'plot-label'},String.fromCharCode(65+t))})}add(s,'text',{x:55,y:278,class:'plot-label'},`More light → Less light；block effect range=${gradient}`);$('.readout',el).textContent=`加性演示模型 Y=20+2×treatment index+block effect+residual；block effects 从 +${fmt(gradient/2,2)} 到 −${fmt(gradient/2,2)}，每个 treatment 的平均 block effect=0。固定 residual SSE=10，RCBD MSE=10/8=1.250；同一数据忽略 block 的 one-way MSE=(10+1.875×gradient²)/12=${fmt((10+1.875*gradient*gradient)/12)}，MSE ratio=${fmt((10+1.875*gradient*gradient)/15)}。无梯度时 blocking 会损失 df；强梯度时可提高 precision。Seed=${seed}。`}draw();mountLatinDesigner($('#latin',el));$('#randomize',el).onclick=()=>{seed++;draw()}}
function labRegression(el){setup(el,`<div class="controls">${range('ry','Last observation Y at x=7',8,40,.5,26)}${range('rx','Prediction x₀',0,9,.1,4)}<label for="band">Interval<select id="band"><option value="mean">Mean confidence interval</option><option value="prediction">New-observation prediction interval</option></select></label></div>${svg('Road example 的 least-squares line、vertical residuals 与 逐点 95% CI / PI')}<div class="readout" aria-live="polite"></div><p class="caption">Road resurfacing 课程数值示例，修改点用于 sensitivity 演示。实线 fitted mean，阴影连接每个固定 x 上的 pointwise 95% CI / PI；它不是整条曲线的 95% 同时置信带，也不保证所有未来个体同时落入。虚线 segments 是 vertical residuals。x₀ 在观测范围 [1,7] 外时属于 extrapolation。</p>`,()=>{const x=[1,3,4,5,7],y=[6,14,10,14,val('ry',el)],r=M.regression(x,y),x0=val('rx',el),pi=$('#band',el).value==='prediction',tc=M.studentQuantile(.975,3),hw=v=>tc*Math.sqrt(r.mse*((pi?1:0)+1/5+(v-r.xb)**2/r.sxx)),pred=v=>r.intercept+r.slope*v,s=$('svg',el),ylo=Math.min(-15,pred(0)-hw(0)),yhi=Math.max(48,pred(9)+hw(9)),map=axes(s,'x: mileage','Y: cost',0,9,ylo,yhi);let d='';for(let i=0;i<=100;i++){const v=i*9/100;d+=(i?' L':'M')+map.x(v)+','+map.y(pred(v)+hw(v))}for(let i=100;i>=0;i--){const v=i*9/100;d+=' L'+map.x(v)+','+map.y(pred(v)-hw(v))}add(s,'path',{d:d+'Z',fill:'#d0e5db'});curve(s,pred,0,9,map);x.forEach((v,i)=>{add(s,'line',{x1:map.x(v),x2:map.x(v),y1:map.y(y[i]),y2:map.y(r.pred[i]),stroke:'#9a472e','stroke-dasharray':'4 3'});add(s,'circle',{cx:map.x(v),cy:map.y(y[i]),r:5,fill:'#086f68'})});add(s,'line',{x1:map.x(x0),x2:map.x(x0),y1:45,y2:265,stroke:'#50655f','stroke-dasharray':'3 3'});$('.readout',el).textContent=`ŷ=${fmt(r.intercept)}+${fmt(r.slope)}x · SSE=${fmt(r.sse)} · MSE=${fmt(r.mse)} · r=${fmt(r.r)} · R²=${fmt(r.r2)} · x₀=${fmt(x0,1)}: ŷ=${fmt(pred(x0))}, pointwise 95% ${pi?'PI':'mean CI'}=[${fmt(pred(x0)-hw(x0))},${fmt(pred(x0)+hw(x0))}]${x0<1||x0>7?' · extrapolation：模型在该范围未由观测支持':''}`})}
const builders={summary:labSummary,probability:labProbability,inference:labInference,paired:labPaired,variance:labVariance,anova:labAnova,multiple:labMultiple,factorial:labFactorial,design:labDesign,regression:labRegression};
if (typeof document !== 'undefined') {
for(const host of document.querySelectorAll('[data-lab]')){const kind=host.dataset.lab,[title,intro]=instructions[kind];host.innerHTML=`<h2>${title}</h2><p class="intro">${intro}</p><div class="lab-body"></div>`;builders[kind]($('.lab-body',host))}
const sidebar=$('.sidebar details');if(sidebar&&matchMedia('(min-width:701px)').matches)sidebar.open=true;
function getProgress(){try{return normalizeReadingProgress(JSON.parse(localStorage.getItem('cpsc440-progress')||'[]'))}catch{return []}}function setProgress(v){try{localStorage.setItem('cpsc440-progress',JSON.stringify(normalizeReadingProgress(v)));return true}catch{return false}}
const complete=$('#complete');if(complete){function refresh(){complete.setAttribute('aria-pressed',String(getProgress().includes(complete.dataset.chapter)));complete.textContent=getProgress().includes(complete.dataset.chapter)?'已标记完成 · 再点撤销':'标记本章已完成'}refresh();complete.onclick=()=>{let p=getProgress();const id=complete.dataset.chapter;p=p.includes(id)?p.filter(v=>v!==id):[...p,id];if(!setProgress(p)){$('#progress-error').textContent='浏览器未允许保存进度；正文与实验仍可使用。'}refresh()}}
const prog=$('#progress-count');if(prog)prog.textContent=`已标记 ${getProgress().length}/${readingChapterIds.length} 个单元。进度只保存在此浏览器。`;
const search=$('#search');
if(search) mountSearch({input:search,results:$('#search-results'),fetchIndex:async()=>{
  const response=await fetch('./search.json');
  if(!response.ok)throw Error('Search index');
  return response.json();
}});

}
