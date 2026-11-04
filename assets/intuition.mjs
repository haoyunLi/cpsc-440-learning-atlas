import { regressionAnalysis } from './regression.mjs';
import { equationHTML } from './formulas.mjs';

const number = x => Number(x.toFixed(3)).toString();
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const variance = a => a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1);
const colors = ['#086f68', '#9a472e', '#435c94'];
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (x, y, label, attrs = '') => `<text x="${x}" y="${y}" ${attrs}>${escape(label)}</text>`;
const line = (x1, y1, x2, y2, attrs = '') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${attrs}/>`;
function rowsPlot(rows, low, high, labels) {
  const x = v => 90 + (v - low) / (high - low) * 500;
  let svg = '';
  rows.forEach((a, i) => {
    const y = 80 + i * 72, center = mean(a);
    svg += text(18, y - 24, labels[i]);
    svg += line(90, y, 590, y, 'class="story-axis"');
    a.forEach((v, j) => { svg += `<circle cx="${x(v)}" cy="${y}" r="6" fill="${colors[i % 3]}"><title>${escape(labels[i])} · 第${j + 1}个：${number(v)}</title></circle>`; });
    svg += line(x(center), y - 20, x(center), y + 16, 'stroke="#183a37" stroke-dasharray="3 3"');
    svg += text(600, y + 28, `均值 ${number(center)}`, 'text-anchor="end" class="story-mean"');
  });
  const bottom = 80 + (rows.length - 1) * 72 + 60;
  for (let i = 0; i < 5; i++) svg += text(90 + 125 * i, bottom, number(low + (high - low) * i / 4), 'text-anchor="middle"');
  return svg;
}
function intervalPlot(items, low, high) {
  const x = v => 100 + (v - low) / (high - low) * 490;
  let svg = '';
  items.forEach((item, i) => {
    const y = 85 + i * 90, c = colors[i];
    svg += text(20, y - 30, item.label);
    svg += line(x(item.lower), y, x(item.upper), y, `stroke="${c}" stroke-width="5" ${i ? 'stroke-dasharray="8 5"' : ''}`);
    for (const v of [item.lower, item.upper]) {
      svg += line(x(v), y - 9, x(v), y + 9, `stroke="${c}" stroke-width="2"`);
      svg += text(x(v), y + 30, number(v), 'text-anchor="middle"');
    }
    svg += `<circle cx="${x(item.center)}" cy="${y}" r="7" fill="#183a37"/>`;
  });
  return svg;
}

export function intuitionState(kind, value) {
  if (!Number.isFinite(value)) throw Error('请选择有效数值。');
  let svg, tex, summary, explanation, metrics;
  if (kind === 'spread' || kind === 'stability') {
    const a = value, fixed = [8, 9, 10, 11, 12], moving = [-2,-1,0,1,2].map(d => 10 + d * a);
    const v = variance(moving), sd = Math.sqrt(v);
    svg = rowsPlot([fixed, moving], 3, 17, kind === 'spread' ? ['原来：五株苗', '现在：只改变散开程度'] : ['甲机器：五袋重量', '乙机器：五袋重量']);
    tex = String.raw`\bar y=10,\qquad s^2=\frac{\sum_{i=1}^{5}(y_i-10)^2}{5-1}=${number(v)},\qquad s=${number(sd)}`;
    summary = `现在五个数是 ${moving.map(number).join('、')}。均值仍是 10；方差为 ${number(v)}，标准差为 ${number(sd)}。`;
    explanation = a === 0 ? '五个点叠在 10 上，偏离全为零，所以标准差也为零。重叠的点仍代表五个单位。' : `最低和最高的点离 10 都是 ${number(2*a)}；中间两个离 10 是 ${number(a)}。距离变了，中心没变。虚线标记均值；相同位置的点会重叠。`;
    metrics = { values: moving, mean: 10, variance: v, sd };
  } else if (kind === 'conditional') {
    const filtered = value === 1, denominator = filtered ? 8 : 20;
    svg = '';
    for (let i = 0; i < 20; i++) {
      const x = 65 + i % 10 * 57, y = 72 + Math.floor(i/10)*75, active = !filtered || i < 8;
      svg += `<rect x="${x-17}" y="${y-20}" width="36" height="40" rx="3" fill="${i < 6 ? '#086f68' : '#e8efea'}" stroke="#50655f" opacity="${active ? 1 : .2}"/>`;
      svg += text(x, y+6, i < 6 ? '堵' : '畅', `text-anchor="middle" fill="${i<6?'white':'#183a37'}" opacity="${active?1:.2}"`);
      if (!active) svg += line(x-14,y-17,x+14,y+17,'stroke="#9a472e"');
    }
    svg += text(30, 210, '前 8 个格子是雨天；其中前 6 个同时堵车。');
    svg += text(30, 242, filtered ? '划掉的晴天不再进入分母。' : '此时分母仍包含全部 20 天。');
    tex = filtered ? String.raw`P(\text{jam}\mid\text{rain})=\frac{6}{8}=75\%` : String.raw`P(\text{jam}\cap\text{rain})=\frac{6}{20}=30\%`;
    summary = `现在比较范围是${filtered ? '8 个雨天' : '全部 20 天'}，目标 6 天占 ${number(600/denominator)}%。`;
    explanation = filtered ? '知道下雨后，晴天不参与比较。分子仍是同样 6 天，分母从 20 变成 8。' : '这是“既下雨又堵车”在全部日子里的比例。它还没有限定“已知下雨”。';
    metrics = { numerator: 6, denominator, probability: 6/denominator };
  } else if (kind === 'precision') {
    const se = 4 / Math.sqrt(value), half = 1.959963984540054 * se;
    svg = intervalPlot([{label:`${value} 株，样本均值设为 20 厘米`, lower:20-half, upper:20+half, center:20}], 15,25);
    svg += text(30, 170, `标准误 ${number(se)} 厘米 → 95% 区间半宽 ${number(half)} 厘米`);
    tex = String.raw`\mathrm{SE}=\frac{4}{\sqrt{${value}}}=${number(se)},\qquad 20\pm1.960\times${number(se)}`;
    summary = `${value} 株：95% 均值置信区间约为 [${number(20-half)}, ${number(20+half)}] 厘米。`;
    explanation = '这是把其他条件固定后的宽度比较，不是假装实际抽样总会得到均值 20。95% 描述反复按同一方法构造区间的长期覆盖率；单个已算出的区间并不赋予固定总体均值一个 95% 的随机概率。';
    metrics = { n:value, se, half, lower:20-half, upper:20+half };
  } else if (kind === 'pairing') {
    const a = [8,10,12,14], b = value ? [16,13,12,9] : [9,12,13,16], differences = b.map((v,i)=>v-a[i]);
    svg = '';
    a.forEach((v,i)=>{
      const y1=230-(v-8)*20,y2=230-(b[i]-8)*20;
      svg += line(150,y1,470,y2,`stroke="${colors[i%3]}" stroke-width="2"`);
      svg += `<circle cx="150" cy="${y1}" r="5" fill="#183a37"/><circle cx="470" cy="${y2}" r="5" fill="#183a37"/>`;
      svg += text(120,y1+6,`A${i+1}: ${v}`,'text-anchor="end"')+text(490,y2+6,`B: ${b[i]}`);
    });
    svg += text(150,260,'前','text-anchor="middle"')+text(470,260,'后','text-anchor="middle"');
    const sd=Math.sqrt(variance(differences)), se=sd/2;
    tex=String.raw`d_i=B_i-A_i,\qquad\bar d=1.5,\qquad s_d=${number(sd)},\quad\mathrm{SE}(\bar d)=\frac{s_d}{\sqrt4}=${number(se)}`;
    summary=`${value?'打乱后的':'保留身份的'}四个差值：${differences.join('、')}。平均差是 1.5，差值标准差为 ${number(sd)}。`;
    explanation=value?'线条交错：现在减到的已经不是同一株。这个错误配对展示了身份信息如何影响差值；它不能用于研究结论。':'每条线连接同一株的前后测量。每株增加得比较接近，所以差值波动小。';
    metrics={a,b,differences,mean:mean(differences),sd,se};
  } else if(kind==='anova') {
    const groups=[-1,0,1].map(g=>[-1,0,1].map(e=>10+g*value+e)), mse=1, between=6*value**2, f=between/2;
    svg=rowsPlot(groups,2,18,['甲肥料','乙肥料','丙肥料']);
    tex=String.raw`F=\frac{\mathrm{MS}_{\text{between}}}{\mathrm{MS}_{\text{within}}}=\frac{${number(between)}/2}{6/6}=${number(f)}`;
    summary=`三组均值为 ${groups.map(g=>number(mean(g))).join('、')}；组内平均平方始终为 1；F=${number(f)}。`;
    explanation='每组仍是“中心−1、中心、中心+1”，所以组内波动不变。F 变大表示相对的组间信号变强；正式推断还需要独立、正态和共同方差等条件。';
    metrics={groups,mse,sstrt:between,sse:6,dfBetween:2,dfError:6,f};
  } else if(kind==='multiplicity') {
    const risk=1-.95**value;svg='';
    for(let i=0;i<value;i++) svg+=`<rect x="${30+i%10*57}" y="${35+Math.floor(i/10)*35}" width="40" height="22" fill="#e8efea" stroke="#086f68"/>`;
    svg+=text(30,210,'至少一次误报的概率（不是这一轮实际误报的数量）');
    svg+=`<rect x="30" y="230" width="570" height="18" fill="#e8efea"/><rect x="30" y="230" width="${570*risk}" height="18" fill="#9a472e"/>`;
    tex=String.raw`P(\text{at least one false alarm})=1-0.95^{${value}}\approx${number(100*risk)}\%`;
    summary=`${value} 个独立且原假设都为真的比较：至少一次误报的概率约 ${number(100*risk)}%。`;
    explanation='上方每格表示一个比较，不是在模拟已发生的误报。独立性让“全部不误报”的概率可以相乘；不独立时不能直接用这个乘法公式。Bonferroni 的上界不要求独立。';
    metrics={m:value,risk};
  } else if(kind==='interaction') {
    const means=[[10,14],[10,14+value]], y=v=>240-(v-5)*9;
    svg=line(130,250,510,250,'class="story-axis"');
    means.forEach((a,i)=>{
      svg+=line(140,y(a[0]),500,y(a[1]),`stroke="${colors[i]}" stroke-width="3" ${i?'stroke-dasharray="8 5"':''}`);
      a.forEach((v,j)=>{svg+=`<circle cx="${140+j*360}" cy="${y(v)}" r="6" fill="${colors[i]}"/>`;});
      svg+=text(335,35+i*30,`${i?'多水 · 虚线':'少水 · 实线'}：增加 ${number(a[1]-a[0])}`);
    });
    svg+=text(140,275,'原肥料','text-anchor="middle"')+text(500,275,'新肥料','text-anchor="middle"');
    tex=String.raw`\text{interaction}=[(${number(14+value)}-10)-(14-10)]=${number(value)}`;
    summary=`少水时肥料效果为 +4；多水时为 ${number(4+value)}；两个效果相差 ${number(value)}。`;
    explanation=value===0?'两条线重合且平行：这组总体均值设定中的肥料效果相同，没有交互。':'两条线不平行：肥料效果取决于水量。这里展示的是设定的总体均值；实际样本中的不平行还可能来自抽样波动，需要检验。';
    metrics={means,effectLow:4,effectHigh:4+value,interaction:value};
  } else if(kind==='blocking') {
    const groups=[0,1].map(b=>[0,1,2].map(t=>10+2*t+(b?value:-value)+(b?1-t:t-1)));
    svg=rowsPlot(groups,3,21,['西片田：三种肥料','东片田：三种肥料']);
    const mse=2, omitted=(6*value**2+4)/3;
    tex=String.raw`\mathrm{MSE}_{\text{block}}=\frac4{2}=2,\qquad \mathrm{MSE}_{\text{omit block}}=\frac{6(${number(value)})^2+4}{3}=${number(omitted)}`;
    summary=`分出田块后的误差均方为 2；忽略田块时为 ${number(omitted)}。每片田的三个点依次为甲、乙、丙肥料。`;
    explanation='这是两片田、每片田含全部三种肥料的固定教学数据；误差安排保持行列和为零。田块差异越大，单独分离它越有帮助；差异为零时，多用一个自由度可能反而不划算。';
    metrics={groups,sse:4,dfError:2,mse,omitted};
  } else if(kind==='prediction') {
    const r=regressionAnalysis({x0:value});
    svg=intervalPlot([{...r.mean,center:r.estimate,label:'估计同一 x 下的总体平均值 · 实线'},{...r.prediction,center:r.estimate,label:'预测一个独立新观测 · 虚线'}],-10,50);
    tex=String.raw`h_0=\frac15+\frac{(${number(value)}-4)^2}{20}=${number(r.h0)},\quad\mathrm{SE}_{\text{mean}}=\sqrt{\mathrm{MSE}\,h_0},\quad\mathrm{SE}_{\text{new}}=\sqrt{\mathrm{MSE}(1+h_0)}`;
    summary=`x₀=${number(value)}，预测中心为 ${number(r.estimate)}。均值区间 [${number(r.mean.lower)}, ${number(r.mean.upper)}]；新个体区间 [${number(r.prediction.lower)}, ${number(r.prediction.upper)}]。`;
    explanation=`两类区间在同一尺度上比较；新个体多一份自身波动。${r.extrapolation?'当前 x₀ 超出已有 x 的 [1,7] 范围，是外推：区间能算出，也不保证模型在这里适用。':'离 x 的中心 4 越远，平均线在这里估得也越不准。'}这里使用线性均值、独立正态误差与共同方差模型。这些是逐点区间，不是整条曲线的同时置信带。`;
    metrics={h0:r.h0,estimate:r.estimate,mean:r.mean,prediction:r.prediction,extrapolation:r.extrapolation};
  } else throw Error('未知的直觉实验。');
  return {svg,tex,summary,explanation,metrics};
}

export function mountIntuition(root, spec) {
  if(root.dataset.ready) return;
  const input=root.querySelector('[data-story-input]'), output=root.querySelector('[data-story-value]');
  const update=()=>{
    const value=Number(input.value), s=intuitionState(spec.kind,value);
    output.textContent=spec.kind==='conditional'?(value?'只看雨天':'全部日子'):spec.kind==='pairing'?(value?'打乱身份':'保留身份'):number(value);
    for(const plot of root.querySelectorAll('[data-story-plot],[data-story-zoom]')) { plot.innerHTML=s.svg; plot.setAttribute('aria-label',s.summary); }
    root.querySelector('[data-story-summary]').textContent=s.summary;
    root.querySelector('[data-story-explanation]').textContent=s.explanation;
    root.querySelector('[data-story-formula]').innerHTML=equationHTML(s.tex);
  };
  input.addEventListener('input',update);input.addEventListener('change',update);
  root.querySelector('[data-story-reset]').addEventListener('click',()=>{input.value=String(spec.value);update();});
  const choices=[...root.querySelectorAll('[data-story-choice]')];
  choices.forEach((button,i)=>button.addEventListener('click',()=>{
    choices.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    root.querySelector('[data-story-feedback]').textContent=(i===spec.answer?'这个判断对。':'可以这样再想一步：')+spec.feedback;
  }));
  update();root.dataset.ready='true';
  for(const b of root.querySelectorAll('button,input')) b.disabled=false;
}
if(typeof document!=='undefined') for(const root of document.querySelectorAll('[data-intuition]')) {
  mountIntuition(root,JSON.parse(root.querySelector('[data-story-config]').textContent));
}
