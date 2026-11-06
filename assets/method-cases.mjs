import { anova, fSurvival, mean, regression, studentCDF, studentQuantile, variance } from './math.mjs';
import { equationHTML } from './formulas.mjs';

const sum = values => values.reduce((a,b) => a+b,0);
const number = (x, digits=3) => String(Number(x.toFixed(digits)));
const fmt = (x,digits=2) => number(x,digits).replace('-','−');
const pval = p => p > 0 && p < .001 ? p.toExponential(2) : fmt(p,4);
const colors = ['#156b67','#994b30','#5a4b89'];

export function anovaCase(unequal) {
  const groups = unequal
    ? [[10,11,11,12,12,12,12,13,13,14],[11,12,12,13,13,13,13,14,14,15],[8,14,20,26]]
    : [12,13,17].map(m => [-2,-1,0,1,2].map(d => m+d));
  const ordinary = anova(groups);
  const variances = groups.map(variance);
  const weights = groups.map((g,i) => g.length/variances[i]);
  const share = weights.map(w => w/sum(weights));
  const center = sum(ordinary.means.map((m,i) => m*share[i]));
  const u = sum(share.map((h,i) => (1-h)**2/(groups[i].length-1)));
  const df1 = groups.length-1, df2 = (groups.length**2-1)/(3*u);
  const f = sum(ordinary.means.map((m,i) => weights[i]*(m-center)**2))/df1
    / (1+2*(groups.length-2)*u/(groups.length**2-1));
  return {groups,ordinary,variances,weights,share,center,welch:{u,df1,df2,f,p:fSurvival(f,df1,df2)}};
}

export function blockCase(missing) {
  const a = [10,18,26,34], b = [12,21,27,missing ? null : 37];
  const differences = b.flatMap((v,i) => v===null ? [] : [v-a[i]]);
  const estimate = mean(differences), df = differences.length-1;
  const se = Math.sqrt(variance(differences)/differences.length);
  const t = estimate/se, critical = studentQuantile(.975,df);
  return {a,b,differences,estimate,df,se,t,lo:estimate-critical*se,hi:estimate+critical*se,
    p:2*studentCDF(-Math.abs(t),df),rawA:mean(a),rawB:mean(b.filter(v => v!==null)),
    raw:mean(b.filter(v => v!==null))-mean(a)};
}

export function regressionCase(scenario) {
  const doses = [0,1,2,3,4];
  const groups = doses.map(x => (scenario===2 ? [0] : [-1,0,1]).map(e => 5+4*x+(scenario ? 2*(x-2)**2 : 0)+e));
  const x = groups.flatMap((g,i) => g.map(() => doses[i])), y = groups.flat();
  const fit = regression(x,y), centers = groups.map(mean);
  const dfPE = fit.n-doses.length, dfLOF = doses.length-2;
  const ssPE = sum(groups.flatMap((g,i) => g.map(v => (v-centers[i])**2)));
  const ssLOF = Math.max(0,fit.sse-ssPE);
  const slopeF = fit.ssr/fit.mse;
  const lofF = dfPE ? (ssLOF/dfLOF)/(ssPE/dfPE) : null;
  return {doses,groups,x,y,fit,centers,dfPE,dfLOF,ssPE,ssLOF,slopeF,
    slopeP:fSurvival(slopeF,1,fit.n-2),lofF,lofP:lofF===null ? null : fSurvival(lofF,dfLOF,dfPE)};
}

export function factorialCase(shape) {
  const centers = [
    [[10,14],[14,18]], // parallel: both variety gaps are +4
    [[10,18],[14,14]], // crossing: +4 and -4 cancel in the marginal mean
    [[10,12],[14,20]], // nonparallel: +4 and +8, no reversal
  ][shape];
  const cells = centers.flat().map(m => [m-1,m,m+1]);
  const r = cells[0].length, df = cells.length*(r-1);
  const sse = sum(cells.map(g => (r-1)*variance(g))), mse = sse/df;
  const marginal = centers.map(mean);
  const low = centers[1][0]-centers[0][0], high = centers[1][1]-centers[0][1];
  const contrasts = [
    [-.5,-.5,.5,.5], // V2 minus V1 averaged over doses
    [1,-1,-1,1], // high-dose gap minus low-dose gap
    [0,-1,0,1], // V2 minus V1 at high dose
  ].map(weights => {
    const estimate = sum(centers.flat().map((m,i) => weights[i]*m));
    const weightSquares = sum(weights.map(w => w*w));
    const se = Math.sqrt(mse*weightSquares/r), t = estimate/se;
    return {estimate,weights,weightSquares,se,t,f:t*t,p:2*studentCDF(-Math.abs(t),df)};
  });
  return {centers,cells,marginal,low,high,r,df,sse,mse,contrasts};
}

export function unbalancedCase(highCounts) {
  const centers = [[10,20],[12,22]];
  const counts = highCounts.map(n => [10-n,n]);
  const weights = highCounts.map(n => n/10);
  const raw = centers.map((g,i) => sum(g.map((m,j) => m*counts[i][j]))/10);
  const adjusted = centers.map(mean);
  return {centers,counts,weights,raw,adjusted,rawDifference:raw[1]-raw[0],adjustedDifference:adjusted[1]-adjusted[0]};
}

export function factorialSSCase(type,bFirst) {
  // Same cell order and data as the Chapter 14 worked example.
  const cells = [[7,8,9],[11,13],[10,12],[12,13,15,16],[16],[18,20,22]];
  const sizes = cells.map(g => g.length), mu = cells.map(mean), all = cells.flat();
  const rows = [0,2,4].map(i => [...cells[i],...cells[i+1]]);
  const cols = [0,1].map(j => cells.filter((_,i) => i%2===j).flat());
  const within = groups => sum(groups.map(g => {
    const m = mean(g);
    return sum(g.map(v => (v-m)**2));
  }));
  const sse = {null:within([all]), A:within(rows), B:within(cols), full:within(cells)};
  // In the additive fit B2-B1 is common across A. Eliminating each row intercept
  // leaves a weighted fit to the row differences, with these inverse variance factors.
  const rowDiff = [0,2,4].map(i => mu[i+1]-mu[i]);
  const precision = [0,2,4].map(i => 1/(1/sizes[i]+1/sizes[i+1]));
  const common = sum(rowDiff.map((v,i) => v*precision[i]))/sum(precision);
  const interactionSS = sum(rowDiff.map((v,i) => precision[i]*(v-common)**2));
  sse.add = sse.full+interactionSS;
  const df = all.length-cells.length, mse = sse.full/df;
  const marginalA = [0,2,4].map(i => mean(mu.slice(i,i+2)));
  const marginalB = [0,1].map(j => mean(mu.filter((_,i) => i%2===j)));
  const [d1,d2] = marginalA.slice(1).map(m => m-marginalA[0]);
  const bGap = marginalB[1]-marginalB[0];
  const rowVar = [0,2,4].map(i => (1/sizes[i]+1/sizes[i+1])/4);
  const [v11,v12,v22] = [rowVar[0]+rowVar[1],rowVar[0],rowVar[0]+rowVar[2]];
  const vB = sum(sizes.map(n => 1/n))/9;
  // The two A contrasts share the A1 mean: invert their 2 by 2 covariance factor.
  const ssA3 = (v22*d1*d1-2*v12*d1*d2+v11*d2*d2)/(v11*v22-v12*v12);
  const typeI = bFirst ? [sse.B-sse.add,sse.null-sse.B] : [sse.null-sse.A,sse.A-sse.add];
  const terms = [
    typeI,
    [sse.B-sse.add,sse.A-sse.add],
    [ssA3,bGap*bGap/vB],
  ][type].concat(interactionSS).map((ss,i) => {
    const numeratorDf = [2,1,2][i], f = ss/numeratorDf/mse;
    return {ss,df:numeratorDf,f,p:fSurvival(f,numeratorDf,df)};
  });
  return {cells,sse,df,mse,marginalA,marginalB,terms};
}

const cases = {
  ss:{
    scenarios:[
      ['Type I · 按顺序','顺序表的 A 行会把哪一段拟合改进记到 A 名下？'],
      ['Type II · 调整主效应','Type II 的 A 行要先考虑 B。用哪两个模型算 A 的平方和？'],
      ['Type III · 等权边际','在允许 A×B 的完整模型里，要问三个品种按两种培养条件各占一半时是否一样高。要检验什么？'],
    ],
    scenarioLabel:'选择平方和类型',
    prompt:'先判断：这行检验在比什么？',
    question:'想一想被比较的模型或均值，再选一项。',
    answerLabel:'选择检验的比较对象',
    choices:[
      '固定比较仅有 B 和 A+B；这一步不加入 A×B',
      '允许 A×B，检验三个品种的等权边际均值是否相同',
      '按写入顺序，比加入 A 前后的两个模型',
    ],
    correct:[2,0,1],
    hints:[
      'B 到 A+B 只衡量加性模型里的增量。题目可能在问顺序，或在问完整模型里的边际均值。',
      '等权边际比较来自完整模型预测的格均值。题目若问加一项少掉多少误差，先找那一步的起点。',
      '顺序表的起点会跟着顺序变。再看题目是不是指定了一个固定的比较。',
    ],
    views:['A 先，B 后','B 先，A 后'],
    viewLabel:'交换因素进入模型的顺序',
    viewsChangeAnalysis:true,
    render:showFactorialSS,
  },

  unbalanced:{
    scenarios:[
      ['描述已记录的这批苗','这批已经种出来的苗，按实际肥量构成，V2 的平均高度比 V1 高多少？'],
      ['按相同肥量构成选品种','如果两个品种都打算低肥、高肥各用一半，按这个配比，V2 平均比 V1 高多少？'],
    ],
    scenarioLabel:'选择研究问题',
    prompt:'先想清楚：要描述哪一批苗？',
    question:'要回答这个问题，应该怎么给低肥、高肥分权重？',
    answerLabel:'选择权重',
    choices:['各品种按这批苗的实际盆数加权','两个品种都给低肥、高肥各一半权重','只比较高肥下的两个品种'],
    correct:[0,1],
    hints:[
      '实际盆数能描述已记录的这批苗。如果题目给了共同配比，试着让两个品种都用那个配比。',
      '各占一半是一个指定的目标配比。想想这题是否要描述原来实际种出来的苗。',
      '只用高肥回答的是固定高肥时的简单效应。这题需要把低肥和高肥都纳入平均。',
    ],
    views:['每格 5 盆','V1 多数用高肥','V2 多数用高肥'],
    presets:[[5,5],[8,2],[2,8]],
    rangeLabels:['V1 高肥盆数','V2 高肥盆数'],
    viewLabel:'快速切换样本量',
    viewsChangeAnalysis:true,
    render:showUnbalanced,
  },

  factorial:{
    scenarios:[
      ['问题一：两档都考虑','若低肥和高肥各占一半，种 V2 比种 V1 平均能多长多少？'],
      ['问题二：换肥量会怎样','从低肥换到高肥时，V2 相对 V1 的优势会变大、变小，还是不变？'],
      ['问题三：只用高肥','如果你的温室只用高肥，V2 比 V1 平均高多少？'],
    ],
    scenarioLabel:'选择研究问题',
    prompt:'先选问题，再决定怎么比',
    question:'要回答这个问题，该比较哪几个数字？',
    answerLabel:'选择要比较的量',
    choices:['固定高肥，只比较这一档的 V2 和 V1','先对每个品种的两档均值取平均，再比 V2 和 V1','先在低肥和高肥各算一次 V2−V1，再比较这两个差'],
    correct:[1,2,0],
    hints:[
      '只看高肥能回答高肥条件下的问题。再看看这题是否还需要低肥的信息。',
      '把两档先平均会丢掉每档各自的差。想想这题问的是某一档，还是两档之间的变化。',
      '两个差再相减，回答的是效果有没有随肥量改变。看看这题是否在问这种变化。',
    ],
    views:['平行线','交叉线','张开但不交叉'],
    viewLabel:'切换数据线形',
    viewsChangeAnalysis:true,
    render:showFactorial,
  },

  anova:{
    scenarios:[
      ['各组波动接近','每盆独立种一株。三种肥料各用 5 盆。过往同条件试验支持组内波动相近，且各组高度近似正态。'],
      ['C 组盆少、波动大','每盆仍是独立单位，各组高度近似正态。A、B 各有 10 盆，C 只有 4 盆；独立的先导试验也发现 C 的高度波动明显更大。'],
    ],
    question:'要比较三种肥料的总体平均高度，按题目给的方差条件，优先用哪个总体检验？',
    choices:['经典单因素 ANOVA','Welch ANOVA','Kruskal–Wallis 秩检验'],
    correct:[0,1],
    hints:['想一想：把各组的组内波动合成一个共同误差，需要什么条件？','题目给了共同方差的依据。经典 ANOVA 可以合并估计误差，是此情境的标准做法；Welch 仍可使用。','题目问的是以厘米计的算术均值。改成按名次比较，就换了研究问题。'],
    views:['看每株的高度','看 Welch 怎么分权重'],
    render:showAnova,
  },
  blocks:{
    scenarios:[
      ['四个区组都测到了','把温室分为从暗到亮的 4 个光照区。每区放两盆，在区内随机分配 A 和 B 两种肥料。各盆误差独立，按光照与肥料的加性模型分析。'],
      ['最亮区的 B 漏测','安排仍然相同。记录仪在最亮区的 B 盆读数时断电，失测与实际苗高无关；该区 A 盆正常测到了。'],
    ],
    question:'要估计控制光照之后的 B−A，并说明它的不确定性，应怎样比？',
    choices:['直接用两列原始均值相减','保留区组，用同区的 A 与 B 比','把没测到的高度记作 0'],
    correct:[1,1],
    hints:['想想如果两种肥料剩下的盆不来自相同光照区，原始均值会混入什么？完整时两个估计恰好相同，推断仍须保留区组。','','断电表示没有读数。填 0 会把漏测伪装成一株高度为 0 的苗。'],
    views:['看同一光照区的配对','看直接平均用了哪些盆'],
    render:showBlocks,
  },
  regression:{
    scenarios:[
      ['每档剂量 3 盆 · 均值近直线','5 档剂量，每档 3 个独立的盆。高度总体随剂量上升。误差近似正态且方差相近，你想检验直线能否描述各档平均高度。'],
      ['每档剂量 3 盆 · 均值弯曲','仍是 5 档剂量、每档 3 个独立的盆。两端的平均高度高于拟合直线，中间低于直线。误差条件相同，斜率还是正的。'],
      ['每档剂量只留 1 盆','沿用弯曲情境，每档只留一个独立观测。散点仍可以画出，也能拟合直线。'],
    ],
    question:'若要正式检验直线是否失拟（lack of fit），现在该怎么办？',
    choices:['看斜率的 p 值就够了','用同剂量重复估计纯误差，再检验失拟','画图可以；没有重复，做不了这个失拟 F 检验'],
    correct:[1,1,2],
    hints:['斜率检验问直线是否水平。想想一条总体向上但中间弯曲的曲线。','这个检验需要同一剂量下的独立重复。这里每档只有一盆，纯误差的自由度是多少？','数数每档有几盆。若剂量内有独立重复，就能用它们估计背景波动。'],
    views:['看拟合直线和散点','标出剂量均值到直线的差','标出同剂量内的散布'],
    render:showRegression,
  },
};

const svg = (height,label,body) => `<svg class="mc-svg" viewBox="0 0 350 ${height}" role="img" aria-label="${label}">${body}</svg>`;
const label = (x,y,s,anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
const line = (x1,y1,x2,y2,cls='mc-guide') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const dot = (x,y,fill,r=4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const diamond = (x,y,fill) => `<path fill="${fill}" d="M${x},${y-5}l5,5 -5,5 -5,-5z"/>`;
const eq = (title,...lines) => `<div class="mc-formula"><b>${title}</b>${lines.map(t => '<div class="typeset-equation">'+equationHTML(t)+'</div>').join('')}</div>`;
const tex = String.raw;
const metric = (label,value) => `<div class="mc-metric"><span>${label}</span><strong>${value}</strong></div>`;
const metrics = (...items) => `<div class="mc-metrics">${items.join('')}</div>`;

function showAnova(scenario,view) {
  const {groups,ordinary,variances,weights,share,center,welch} = anovaCase(scenario);
  const x = v => 42+(v-6)*12.9, w = v => 42+v*2.75, axis = view ? w : x;
  const ticks = view ? [0,25,50,75,100] : [6,12,18,24,28];
  const marks = ticks.map(t => line(axis(t),13,axis(t),159)+label(axis(t),177,t)).join('');
  const rows = groups.map((g,i) => {
    const y = 33+i*50, seen = new Map(), color = colors[i];
    return label(18,y+5,'ABC'[i])+(view
      ? `<rect x="42" y="${y-7}" width="${w(share[i]*100)-42}" height="14" rx="3" fill="${color}"/>`+label(w(share[i]*100)+7,y+5,fmt(share[i]*100,1)+'%','start')
      : g.map(v => {
        const stack = seen.get(v) ?? 0;
        seen.set(v,stack+1);
        return dot(x(v),y+9-stack*7,color,3.1);
      }).join('')+diamond(x(ordinary.means[i]),y+20,color));
  }).join('');
  return {
    plot:svg(205,view ? '各组在 Welch 加权中心中的相对权重' : '三种肥料的苗高散点与均值',
      marks+rows+label(180,200,view ? '相对权重（%）' : '苗高（厘米）')),
    reading:view
      ? '横条越长，该组均值越能拉动 Welch 的加权中心。C 组越少、越散，均值估计越不精确，权重越小。'
      : '圆点是一盆，菱形是组均值。相同高度的圆点竖着叠开。两种情境的均值都是 12、13、17 厘米，变化在每组的盆数和散布。'+
        (scenario ? ' C 的最矮和最高两盆相差 18 厘米。' : ' 三组的样本标准差都是约 1.58 厘米。'),
    evidence:metrics(...groups.map((g,i) => metric('ABC'[i]+' · '+g.length+' 盆',view ? '权重 '+fmt(share[i]*100,1)+'%' : '均值 '+fmt(ordinary.means[i])+' · SD '+fmt(Math.sqrt(variances[i]))))),
    formulas:eq('同一个零假设：三种肥料的总体均值相等',tex`H_0:\ \mu_A=\mu_B=\mu_C`)
      + eq((scenario ? '对照：' : '本题选用：')+'经典 F 用一个合并误差',
        tex`F=\frac{SS_{\rm group}/(k-1)}{SS_E/(N-k)}`,
        tex`F=\frac{${number(ordinary.ssb/ordinary.dft)}}{${number(ordinary.mse)}}=${number(ordinary.f)},\quad \nu_2=${ordinary.dfe}`)
      + eq((scenario ? '本题选用：' : '对照：')+'Welch 用各组自己的均值精度',
        tex`w_i=\frac{n_i}{s_i^2},\quad h_i=\frac{w_i}{\sum_j w_j}`,
        tex`\bar y_w=\sum_i h_i\bar y_i=${number(center)}`,
        tex`U=\sum_i\frac{(1-h_i)^2}{n_i-1},\quad \nu_2=\frac{k^2-1}{3U}`,
        tex`F_W=\frac{\sum_i w_i(\bar y_i-\bar y_w)^2/(k-1)}{1+2(k-2)U/(k^2-1)}`,
        tex`w_C=${number(weights[2])},\quad F_W=${number(welch.f)},\quad \nu_2=${number(welch.df2)}`),
    result:metrics(metric(scenario ? '经典 F（对照）' : '经典 F（本题选用）','p = '+pval(ordinary.p)),
      metric(scenario ? 'Welch F（本题选用）' : 'Welch F（对照）','p = '+pval(welch.p))),
    conclusion:scenario
      ? '按 Welch 的结果，在 5% 水平下没有足够证据说三种肥料的总体平均高度有差异。经典 F 的 p 值虽然低于 0.05，但它所需的共同方差条件在这道题不成立。'
      : '按经典 F 的结果，在 5% 水平下有证据说明至少一种肥料的总体平均高度不同。若要知道是哪一对，下一步才是多重比较。',
  };
}

function showBlocks(scenario,view) {
  const b = blockCase(scenario), x = v => 47+(v-8)*9.1;
  const marks = [10,15,20,25,30,35,40].map(t => line(x(t),14,x(t),174)+label(x(t),191,t)).join('');
  const rows = b.a.map((a,i) => {
    const y = 29+i*41, v = b.b[i];
    return label(19,y+5,i+1)+(v===null || view ? '' : line(x(a),y-5,x(v),y+5,'mc-difference'))
      + dot(x(a),y-5,colors[0],5)
      + (v===null ? label(x(a)-8,y+14,'B 漏测','end') : diamond(x(v),y+5,colors[1]));
  }).join('');
  return {
    plot:svg(217,'四个光照区的 A 与 B 高度；'+(scenario ? '区组 4 缺 B' : '各区都有完整配对'),
      marks+rows+(view ? line(x(b.rawA),13,x(b.rawA),168,'mc-raw-a')
        +line(x(b.rawB),13,x(b.rawB),168,'mc-raw-b') : '')+label(187,213,'苗高（厘米）')),
    reading:view
      ? '实线是 A 的原始均值，虚线是 B 的原始均值。'+(scenario ? 'A 包含最高的光照区，B 的三盆全来自较暗的区。' : 'A、B 各有四盆，覆盖同样的光照区。')
      : '每行是一个光照区（1 最暗，4 最亮）。圆点 A、菱形 B。连线向右，表示在这个光照区 B 较高。'+(scenario ? '第 4 区只有 A，所以这里画不出 B−A。' : ''),
    evidence:view ? metrics(metric('A 的原始均值',fmt(b.rawA)+' cm'),metric('B 的原始均值',fmt(b.rawB)+' cm'),
      metric('原始均值差 B−A',fmt(b.raw)+' cm'))
      : metrics(...b.a.map((a,i) => metric('区组 '+(i+1),b.b[i]===null ? 'A '+a+' · B 漏测' : 'A '+a+' · B '+b.b[i]+' → +'+fmt(b.b[i]-a)))),
    formulas:eq('同区相减，共同的光照效应抵消',
        tex`Y_{ij}=\mu+\beta_j+\tau_i+\varepsilon_{ij}`,tex`D_j=Y_{Bj}-Y_{Aj}`,tex`\operatorname{E}(D_j)=\tau_B-\tau_A`)
      + eq('区组差的均值与标准误：只数完整配对',
        tex`\bar D=\frac{${b.differences.join('+')}}{${b.differences.length}}=${number(b.estimate)}`,
        tex`\mathrm{SE}(\bar D)=\frac{s_D}{\sqrt{${b.differences.length}}}=${number(b.se)}`,
        tex`t=\frac{\bar D-0}{\mathrm{SE}(\bar D)}=${number(b.t)},\quad \nu=${b.df}`)
      + eq('区组差的 95% 置信区间（误差近似正态）',
        tex`\bar D\ \pm\ t_{0.975,${b.df}}\mathrm{SE}(\bar D)`,tex`[${number(b.lo)},\ ${number(b.hi)}]\ \mathrm{cm}`),
    result:metrics(metric('未控制光照的均值差',fmt(b.raw)+' cm'),metric('控制光照后的 B−A',fmt(b.estimate)+' cm'),
      metric('95% CI · 双侧 p = '+pval(b.p),'['+fmt(b.lo)+', '+fmt(b.hi)+'] cm')),
    conclusion:scenario
      ? '直接平均会误以为 B 较矮。同区作差估计 B 高 2 厘米；但区间包含 0，证据不足以说总体处理差不同于 0。本题只有两种处理，同区差的均值等于加性模型中控制 block 后的 B 系数。'
      : '完整时，两列均值差和同区作差的估计都是 2.25 厘米。按区组差估计不确定性，在 5% 水平下有证据说明 B 比 A 高。切到漏测情境，看看原始均值差为什么会变号。',
  };
}

function showRegression(scenario,view) {
  const r = regressionCase(scenario), x = d => 37+72*d, y = h => 174-4.86*h;
  const marks = [0,10,20,30].map(t => line(37,y(t),325,y(t))+label(30,y(t)+4,t,'end')).join('')
    + r.doses.map(d => label(x(d),195,d)).join('');
  const rows = r.groups.map((g,i) => (view===1 ? line(x(i),y(r.centers[i]),x(i),y(r.fit.intercept+r.fit.slope*i),'mc-difference') : '')
    + g.map((v,j) => {
      const xj = x(i)+(g.length===1 ? 0 : (j-1)*7);
      return (view===2 && g.length>1 ? line(xj,y(v),x(i),y(r.centers[i]),'mc-difference') : '')
        + dot(xj,y(v),colors[0],3.5);
    }).join('')
    + (view && g.length>1 ? diamond(x(i),y(r.centers[i]),colors[1]) : '')).join('');
  return {
    plot:svg(220,'各剂量的观测点与拟合直线；'+(['纵轴为苗高（厘米）','竖线标出各档均值与拟合值的差','短线标出同剂量内的高度离均值多远'][view]),
      marks+label(26,17,'cm','start')+(view===2 ? '' : line(x(0),y(r.fit.intercept),x(4),y(r.fit.intercept+4*r.fit.slope),'mc-fit'))+rows+label(180,215,'剂量（档）')),
    reading:view===2
      ? (scenario===2 ? '每档只剩一个点，没有别的盆能与它比较；这里的纯误差自由度为 0。' : '只看同一档剂量。圆点到本档均值（菱形）的高度差是自然波动；把这些差平方相加，就是纯误差平方和。')
      : view===1 ? '竖虚线显示剂量均值到拟合直线的距离。'+(scenario===2 ? '每档只有一点，它也是该档均值；没有档内波动可用来衡量这些距离。' : '菱形是剂量均值。检验问：这些距离比同剂量的自然波动大多少？')
      : '实线是拟合直线，圆点是一盆。同剂量下的圆点稍向左右错开。三种情境的斜率都是每增加一档约高 4 厘米。',
    evidence:view===2 ? metrics(metric('每档观测数',r.groups[0].length),metric('纯误差自由度',r.dfPE),metric('纯误差平方和',r.ssPE))
      : metrics(metric('最左档 · 观测均值 / 直线',fmt(r.centers[0])+' / '+fmt(r.fit.intercept)+' cm'),
      metric('中间档 · 观测均值 / 直线',fmt(r.centers[2])+' / '+fmt(r.fit.intercept+2*r.fit.slope)+' cm')),
    formulas:eq('问题一：斜率是不是零？',
        tex`H_{0,\rm slope}:\ \beta_1=0`,tex`F_{\rm slope}=\frac{SS_R/1}{SS_E/(N-2)}=${number(r.slopeF)}`)
      + eq('问题二：真实的各剂量均值是否在同一直线上？',
        tex`SS_E=SS_{\rm PE}+SS_{\rm LOF}`,
        tex`SS_{\rm PE}=\sum_i\sum_j(y_{ij}-\bar y_i)^2`,
        tex`SS_{\rm LOF}=\sum_i n_i(\bar y_i-\hat y_i)^2`,
        tex`${number(r.fit.sse)}=${number(r.ssPE)}+${number(r.ssLOF)}`)
      + (r.dfPE ? eq('失拟检验：把均值偏离直线的程度与同剂量波动相比',
          tex`F_{\rm LOF}=\frac{${number(r.ssLOF)}/${r.dfLOF}}{${number(r.ssPE)}/${r.dfPE}}=${number(r.lofF)}`)
        : eq('没有纯误差自由度，无法估计分母',tex`df_{\rm PE}=N-k=${r.fit.n}-${r.doses.length}=0`)),
    result:metrics(metric('斜率检验','p = '+pval(r.slopeP)),metric('失拟检验',r.lofP===null ? '不可计算' : 'p = '+pval(r.lofP))),
    conclusion:[
      '斜率显著；失拟检验没有找到直线失拟的证据。此例各档的样本均值恰好落在直线上，不能据此证明真实关系一定是直线。',
      '斜率显著，直线也显著失拟。上升趋势存在，但直线低估两端、高估中间。下一步可以检查二次项并重新看残差。',
      '斜率估计仍是 4，但少了观测，斜率检验的 p 值升到约 0.061。图上仍可以怀疑弯曲；每档只有一盆，估不出纯误差，不能给这个失拟 F 检验报 p 值。',
    ][scenario],
  };
}

function showFactorial(question,shape) {
  const d = factorialCase(shape);
  const x = [65,260], y = v => 182-(v-8)*12;
  const signed = v => v>0 ? '+'+fmt(v) : fmt(v);
  const [[aL,aH],[bL,bH]] = d.centers, [a,b] = d.marginal;
  const [l,h] = x, mid = (l+h)/2;
  const tickMarks = [8,12,16,20].map(v => line(44,y(v),305,y(v))+label(34,y(v)+5,v,'end')).join('');
  const profiles = line(l,y(aL),h,y(aH),'mc-profile-1')+line(l,y(bL),h,y(bH),'mc-profile-2')
    + dot(l,y(aL),colors[0],5)+dot(h,y(aH),colors[0],5)
    + diamond(l,y(bL),colors[1])+diamond(h,y(bH),colors[1]);
  const measure = (x,from,to,gap) => line(x,y(from),x,y(to),'mc-contrast')
    + line(x-4,y(from),x+4,y(from),'mc-contrast')+line(x-4,y(to),x+4,y(to),'mc-contrast')
    + label(x+9,(y(from)+y(to))/2+5,signed(gap),'start');
  const marked = question===0
    ? dot(mid,y(a),colors[0],7)+diamond(mid,y(b),colors[1])+measure(mid+12,a,b,b-a)
    : (question===1 ? measure(l+17,aL,bL,d.low) : '')+measure(h+17,aH,bH,d.high);
  const c = d.contrasts[question];
  const name = [tex`D_V`,tex`I`,tex`\Delta_H`][question];
  const estimate = [
    eq('主效应：每个品种先对低肥、高肥等权平均',
      tex`\bar y_{1\cdot}=(${aL}+${aH})/2=${a}`,
      tex`\bar y_{2\cdot}=(${bL}+${bH})/2=${b}`,
      tex`\widehat D_V=${b}-${a}=${number(c.estimate)}`),
    eq('交互作用：先在每档算 V2−V1，再用高肥的差减去低肥的差',
      tex`\widehat\Delta_L=${bL}-${aL}=${d.low}`,
      tex`\widehat\Delta_H=${bH}-${aH}=${d.high}`,
      tex`\widehat I=${d.high}-(${d.low})=${c.estimate}`),
    eq('简单效应：固定高肥，只用高肥这一列的两个均值',
      tex`\widehat\Delta_H=${bH}-${aH}=${c.estimate}`),
  ][question];
  const weights = c.weights.map(w => w===.5 ? '1/2' : w===-.5 ? '-1/2' : w).join(',');
  const statistic = '<p>本例每格的三盆分别离本格均值 −1、0、+1 cm。四格各贡献 2，组内平方和共 8。每格用掉一个自由度来估计均值，所以误差自由度是 4×(3−1)=8。以下检验假设各盆误差独立、近似正态且共用方差。</p>'
    + eq('对比系数按 V1 低、V1 高、V2 低、V2 高排列',
      tex`c=(${weights}),\quad \sum_i c_i^2=${c.weightSquares}`)
    + eq('四格共用同一个组内误差；对所选比较做双侧检验',
    tex`MS_E=\frac{${d.sse}}{${d.df}}=${d.mse},\quad H_0:\ ${name}=0`,
    tex`SE=\sqrt{MS_E\cdot\frac{${c.weightSquares}}{${d.r}}}=${number(c.se)}`,
    tex`t=\frac{${c.estimate}}{${number(c.se)}}\approx ${number(c.t)},\quad df=${d.df}`)
    + (question===2 ? '' : eq('这个比较有 1 个自由度，和 ANOVA 表对应',
      tex`F_{1,${d.df}}=t^2=${number(c.f)}`));
  const conclusion = [
    shape===1
      ? '两种品种的等权平均都是 14 cm，品种主效应的估计为 0。低肥时 V2 高 4 cm，高肥时却矮 4 cm；两种条件下的效果在平均时抵消了。'
      : '按两种肥量各占一半计算，有证据表明 V2 平均更高，估计高 '+fmt(c.estimate)+' cm。这个平均值只回答两档合起来的问题；想知道每一档的表现，要分别比较。',
    [
      '两个肥量下，V2 都比 V1 高 4 cm，差的差是 0。这组数据没有提供品种优势随肥量变化的证据。',
      '低肥时 V2 高 4 cm，高肥时 V2 矮 4 cm，品种优势减了 8 cm。检验支持品种效果随肥量改变。',
      '两档都是 V2 更高，但优势从 4 cm 增到 8 cm，检验也支持交互作用。两条线只要在样本图上不平行，就表示两个样本差不同；是否有证据说总体差不同，还要看误差和检验。',
    ][shape],
    '只在高肥条件下，数据支持 V2 比 V1 '+(d.high>0 ? '高 ' : '矮 ')+fmt(Math.abs(d.high))+' cm 左右。这个结论适用于高肥；想知道高肥和低肥下的品种差是否一样，去做交互作用那一问。',
  ][question];
  return {
    plot:svg(218,'肥量与苗高的交互图。低肥 V1 '+aL+'、V2 '+bL+'；高肥 V1 '+aH+'、V2 '+bH+' 厘米。',
      tickMarks+label(19,24,'cm','start')+profiles+marked+label(l,205,'低肥')+label(h,205,'高肥')),
    reading:'圆点实线是 V1，菱形虚线是 V2。'+[
      '看图中央的两个标记：它们是各品种对两档取的平均，没有第三个肥量。',
      '看低肥和高肥各自的竖括号：数值带正负号，表示 V2−V1，再用右边的差减左边的差。',
      '只看右侧高肥的竖括号，计算 V2−V1。换线形后，这一档的差可以改变方向。',
    ][question],
    evidence:metrics(
      metric('低肥 · V1 / V2',aL+' / '+bL+' cm'),
      metric('高肥 · V1 / V2',aH+' / '+bH+' cm'),
      metric(['主效应 · 两档平均差','交互作用 · 高肥差 − 低肥差','简单效应 · 只比高肥'][question],signed(c.estimate)+' cm')),
    formulas:estimate+statistic,
    result:metrics(metric('单个预定比较 · 双侧','p = '+pval(c.p))),
    conclusion,
  };
}

function showUnbalanced(question,highCounts) {
  const d = unbalancedCase(highCounts);
  const x = v => 43+(v-8)*17;
  const signed = v => v>0 ? '+'+fmt(v,1) : fmt(v,1);
  const axis = [8,12,16,20,24].map(v => line(x(v),17,x(v),155)+label(x(v),172,v)).join('');
  const rows = d.centers.map(([lo,hi],i) => {
    const y = 30+i*72, raw = x(d.raw[i]), adjusted = x(d.adjusted[i]);
    return label(19,y+6,'V'+(i+1))
      + line(x(lo),y,x(hi),y,'mc-endpoint-span')+dot(x(lo),y,'#466862',3.5)+dot(x(hi),y,'#466862',3.5)
      + label(x(lo),y-8,lo)+label(x(hi),y-8,hi)
      + line(raw,y,raw,y+15,'mc-raw-a')+dot(raw,y+18,colors[0],question===0 ? 6 : 5)
      + label(raw+10,y+23,fmt(d.raw[i]),'start')
      + line(adjusted,y+26,adjusted,y+38,'mc-raw-b')+diamond(adjusted,y+40,colors[1])
      + label(adjusted+10,y+45,fmt(d.adjusted[i]),'start');
  }).join('');
  const mix = `<div class="mc-mix" aria-label="实际肥量构成">${d.counts.map(([lo,hi],i) => `
    <div><b>V${i+1}</b> · 低肥 ${lo} 盆 / 高肥 ${hi} 盆
      <div class="mc-mix-track" aria-hidden="true"><span style="flex:${lo}"></span><span style="flex:${hi}"></span></div>
    </div>`).join('')}</div>`;
  const rawSteps = d.counts.map(([lo,hi],i) => {
    const [a,b] = d.centers[i];
    return tex`\bar y_{${i+1},\rm raw}=\frac{${lo}\cdot ${a}+${hi}\cdot ${b}}{10}=${number(d.raw[i])}`;
  });
  const equalSteps = d.centers.map(([a,b],i) => tex`\mathrm{LSMean}_{${i+1}}=\frac{${a}+${b}}{2}=${d.adjusted[i]}`);
  const rawFormula = eq('原始均值：各品种用自己的实际盆数加权',...rawSteps,
    tex`D_{\rm raw}=${number(d.raw[1])}-${number(d.raw[0])}=${number(d.rawDifference)}`);
  const lsFormula = eq('调整均值：用模型预测的格均值，两种肥量各占一半',
    ...equalSteps,tex`D_{\rm adj}=${d.adjusted[1]}-${d.adjusted[0]}=${d.adjustedDifference}`);
  const decomposition = eq('为什么会反号？先分开品种差和肥量构成差',
    tex`\bar y_{i,\rm raw}=\bar y_{iL}+10w_{iH}`,
    tex`D_{\rm raw}=2+10(w_{2H}-w_{1H})`,
    tex`D_{\rm raw}=2+10(${d.weights[1]}-${d.weights[0]})=${number(d.rawDifference)}`);
  const highGap = highCounts[0]-highCounts[1];
  const reason = d.rawDifference<0
    ? 'V1 的高肥比例比 V2 多 '+highGap*10+' 个百分点。高肥本身对应 +10 cm，这个构成差给原始差带来 '+signed(-highGap)+' cm，盖过了 V2 同肥量下的 +2 cm。'
    : d.rawDifference===0
      ? 'V1 多出的高肥比例带来 −2 cm 的构成差，刚好抵消 V2 同肥量下的 +2 cm。'
      : highGap===0
        ? '两个品种的高肥比例相同，原始均值差里没有肥量构成差。'
        : '原始均值差把同肥量下的 +2 cm 和样本构成带来的 '+signed(-highGap)+' cm 加在了一起。';
  return {
    plot:mix+svg(200,'同一高度轴上比较原始与调整均值。V1 原始 '+fmt(d.raw[0])+'、调整 '+fmt(d.adjusted[0])+'；V2 原始 '+fmt(d.raw[1])+'、调整 '+fmt(d.adjusted[1])+' 厘米。',
      axis+rows+label(179,195,'平均苗高（厘米）')),
    reading:'浅色是低肥盆，深色是高肥盆。小点是固定的格均值；大圆点是原始均值，菱形是两档各半的调整均值。拖动盆数，只有大圆点会左右移动。',
    evidence:metrics(
      metric('按实际盆数 · V2−V1',signed(d.rawDifference)+' cm'),
      metric('按两档各半 · V2−V1',signed(d.adjustedDifference)+' cm')),
    formulas:(question===0 ? rawFormula+lsFormula : lsFormula+rawFormula)
      + '<p>四格都有观测，拟合含品种×肥量交互的模型（<code>height ~ variety * dose</code>）时，每格预测就是该格样本均值。这里的 LSMeans 用同一套 50/50 权重；若目标是别的配比，可以用那个共同配比。上面的差是点估计，样本量变化仍会影响估计精度。</p>'
      + decomposition+'<p>式中的 <b>w<sub>iH</sub></b> 是该品种实际用高肥的比例。因为两种品种各自的高肥均值都比低肥高 10 cm，所以构成差要乘 10。</p>',
    result:'',
    conclusion:(question===0
      ? '要描述这批盆苗，用原始均值：V2−V1 = '+signed(d.rawDifference)+' cm。'
      : '要按低肥、高肥各一半选品种，用等权 LSMeans：V2−V1 = +2 cm。')+reason,
  };
}

function showFactorialSS(type,bFirst) {
  const d = factorialSSCase(type,bFirst), other = factorialSSCase(type,!bFirst);
  const s = d.sse, x = v => 54+v*1.32;
  const terms = ['A','B','A×B'];
  const ticks = [0,50,100,150,200].map(v => line(x(v),17,x(v),157)+label(x(v),175,v)).join('');
  const bars = d.terms.map((t,i) => {
    const y = 35+i*48;
    return label(24,y+5,terms[i])
      + `<rect x="54" y="${y-7}" width="${x(t.ss)-54}" height="12" rx="2" fill="${colors[i]}"/>`
      + line(54,y+11,x(other.terms[i].ss),y+11,'mc-ss-other');
  }).join('');
  const delta = (key,from,to,ss) => tex`SS_{${key}}=${number(from)}-${number(to)}\approx ${number(ss)}`;
  const first = bFirst ? 'B' : 'A', second = bFirst ? 'A' : 'B';
  const compare = type===0
    ? eq('Type I：每走一步，把 SSE 减少的量记给新加入的一项',
      bFirst ? tex`1\to B\to A+B\to A+B+A\!:\!B` : tex`1\to A\to A+B\to A+B+A\!:\!B`,
      bFirst ? delta('B',s.null,s.B,d.terms[1].ss) : delta('A',s.null,s.A,d.terms[0].ss),
      bFirst ? delta('A\\mid B',s.B,s.add,d.terms[0].ss) : delta('B\\mid A',s.A,s.add,d.terms[1].ss))
    : type===1 ? eq('Type II：先留另一个主效应，再问目标项是否减少误差',
      tex`A:\ B\longrightarrow A+B`,
      delta('A\\mid B',s.B,s.add,d.terms[0].ss),
      tex`B:\ A\longrightarrow A+B`,
      delta('B\\mid A',s.A,s.add,d.terms[1].ss))
    : eq('Type III：保留完整模型，检验等权边际均值的约束',
      tex`\widehat m_A=(${d.marginalA.join(tex`,\,`)})`,
      tex`H_{0,A}:m_{A1}=m_{A2}=m_{A3}`,
      tex`\widehat L_A=(2.5,\,8)^{\mathsf T}`,
      tex`W_A=C_A\operatorname{diag}(1/n_i)C_A^{\mathsf T}`,
      tex`W_A=\begin{pmatrix}19/48&5/24\\5/24&13/24\end{pmatrix}`,
      tex`SS_A=\widehat L_A^{\mathsf T}W_A^{-1}\widehat L_A`,
      tex`SS_A\approx ${number(d.terms[0].ss)}`,
      tex`\widehat L_B=(12+14+20)/3-(8+11+16)/3`,
      tex`SS_B=\frac{(11/3)^2}{35/108}\approx ${number(d.terms[1].ss)}`)
      + '<p>A 有两条限制：A2 与 A1 相等、A3 与 A1 相等。对比矩阵 C 的每行把一个品种的两格各乘 1/2，再减去 A1 的两格各乘 1/2。两个差都用到 A1，所以 W 也要计入它们的协方差。B 只有一条限制，35/108 是对应的方差因子。</p>';
  const bottom = eq('三个类型的交互行都比加性模型和完整模型',
    delta('A\\times B',s.add,s.full,d.terms[2].ss))
    + eq('始终用完整模型的误差当分母，以 A 行为例',
      tex`MS_E=\frac{${s.full}}{15-6}=\frac{8}{3}`,
      tex`F_A=\frac{${number(d.terms[0].ss)}/2}{8/3}\approx ${number(d.terms[0].f)}`,
      tex`p_A=\Pr(F_{2,9}\ge ${number(d.terms[0].f)})`);
  const cell = (key,i,format) => {
    const a = format(d.terms[i][key]), b = format(other.terms[i][key]);
    return `<td>${a}${a===b ? '' : `<small aria-label="另一顺序 ${b}">${b}</small>`}</td>`;
  };
  return {
    plot:svg(205,'三项平方和。实条为当前顺序，虚线为另一顺序。',
      ticks+bars+label(184,199,'平方和（SS）')),
    reading:'实条是当前顺序，虚线是另一顺序。'+[
      '现在 '+first+' 先进入，'+second+' 后进入。交换顺序时，A、B 记到的平方和变了；交互这一步的起点和终点都一样。',
      '交换顺序，两种线仍同长。检验 A 总是从仅有 B 的模型出发，检验 B 总是从仅有 A 的模型出发。',
      '交换顺序，两种线仍同长。完整模型和等权边际约束都没有变。',
    ][type],
    evidence:`<table class="mc-ss-table"><caption>当前：${first} 先，${second} 后 · 误差 df = ${d.df}${type===0 ? '<small>灰字是另一顺序下的数值，只标出有变化的项。</small>' : ''}</caption>
      <thead><tr><th scope="col">项</th><th scope="col">SS</th><th scope="col">F</th><th scope="col">p</th></tr></thead>
      <tbody>${terms.map((t,i) => `<tr><th scope="row">${t}</th>${cell('ss',i,v=>fmt(v,3))}${cell('f',i,v=>fmt(v,3))}${cell('p',i,pval)}</tr>`).join('')}</tbody></table>`,
    formulas:compare+bottom,
    result:'',
    conclusion:[
      '如果研究问题本来就有先后顺序，例如先把培养条件 B 放进模型，再问品种 A 多解释了多少，就用相应顺序的 Type I。这里改变顺序只改变 A、B 的记账；完整模型的预测和 SSE 没变。不要用哪个 p 值小来决定顺序。',
      '如果关心在加性部分中调整另一主效应后的增量，就看 Type II。A 行的分子用 B 与 A+B 的 SSE 差，但 F 仍除以完整模型的 MSE。它没有把交互作用为零这件事证明出来。',
      '如果问题明确要求在允许交互的模型里比较等权边际均值，就检验这里的 Type III 假设。它对应显式等权对比（或本例的和为零编码）；默认参考水平系数可能是在比简单效应。若问题只关心一个培养条件，直接做该条件下的简单效应。',
    ][type],
  };
}

const buttons = (options,kind) => options.map((text,i) => `<button type="button" data-mc-${kind}="${i}" aria-pressed="false">${text}</button>`).join('');
const group = (name,buttons) => `<div class="mc-buttons" role="group" aria-label="${name}">${buttons}</div>`;
function setPressed(ui,kind,active) {
  ui.querySelectorAll('[data-mc-'+kind+']').forEach((b,i) => b.setAttribute('aria-pressed',String(i===active)));
}

function mount(root) {
  const c = cases[root.dataset.methodCase];
  if (!c) return;
  const ui = document.createElement('div');
  const sliders = c.rangeLabels?.map((label,i) => {
    const id = 'mc-'+root.dataset.methodCase+'-'+i;
    return `<label class="mc-range" for="${id}"><span>${label} <output aria-hidden="true" for="${id}"></output></span>
      <input id="${id}" type="range" min="1" max="9" value="5" data-mc-range="${i}"></label>`;
  }).join('') ?? '';
  ui.innerHTML = `<p class="mc-stage">① ${c.prompt ?? '先选情境，再判断'}</p>
    ${group(c.scenarioLabel ?? '选择情境',buttons(c.scenarios.map(s=>s[0]),'scenario'))}
    <p class="mc-story" aria-live="polite"></p><p><b>${c.question}</b></p>
    ${group(c.answerLabel ?? '选择统计方法',buttons(c.choices,'answer'))}
    <p class="mc-feedback" role="status"></p>
    <div class="mc-output" hidden><p class="mc-stage">② 操作图形，核对你的判断</p>
    ${group(c.viewLabel ?? '改变图形显示',buttons(c.views,'view'))}
    ${sliders ? '<p class="mc-range-guide">每个品种固定 10 盆；高肥多一盆，低肥就少一盆。</p><div class="mc-ranges">'+sliders+'</div>' : ''}
    <figure class="mc-figure"><div class="mc-chart"></div><figcaption class="mc-reading"></figcaption></figure>
    <div class="mc-evidence" aria-live="polite"></div>
    <details class="mc-derivation"><summary>③ 展开 LaTeX 推导与结论</summary><div class="mc-calculation"></div></details></div>`;
  const get = cls => ui.querySelector('.mc-'+cls);
  const ranges = [...ui.querySelectorAll('[data-mc-range]')];
  const initialView = () => c.presets ? [...c.presets[0]] : 0;
  let scenario = 0, view = initialView(), solved = false;
  function feedback(message,state='') {
    get('feedback').textContent = message;
    get('feedback').dataset.state = state;
  }
  function hideResult() {
    solved = false;
    get('output').hidden = true;
    get('derivation').open = false;
  }
  function reset() {
    view = initialView();
    hideResult();
    setPressed(ui,'scenario',scenario);
    setPressed(ui,'answer',-1);
    get('story').textContent = c.scenarios[scenario][1];
    feedback('选一个方法，答对后打开图和解析。');
  }
  function draw(includeDerivation) {
    const next = c.render(scenario,view);
    const active = c.presets ? c.presets.findIndex(pair => pair.every((n,i) => n===view[i])) : view;
    setPressed(ui,'view',active);
    ranges.forEach((input,i) => {
      const label = '高肥 '+view[i]+' 盆，低肥 '+(10-view[i])+' 盆';
      input.value = view[i];
      input.setAttribute('aria-valuetext',label);
      input.closest('label').querySelector('output').textContent = label;
    });
    get('chart').innerHTML = next.plot;
    get('reading').textContent = next.reading;
    get('evidence').innerHTML = next.evidence;
    if (includeDerivation) get('calculation').innerHTML = next.formulas+next.result+`<p class="mc-conclusion"><b>结论：</b>${next.conclusion}</p>`;
  }
  ui.addEventListener('click',event => {
    const b = event.target.closest('button');
    if (!b) return;
    if ('mcScenario' in b.dataset) {
      const selected = Number(b.dataset.mcScenario);
      if (scenario!==selected) { scenario = selected; reset(); }
    } else if ('mcAnswer' in b.dataset) {
      const answer = Number(b.dataset.mcAnswer);
      setPressed(ui,'answer',answer);
      if (answer===c.correct[scenario]) {
        if (!solved) draw(true);
        solved = true;
        get('output').hidden = false;
        feedback('选对了。接下来切换图形视图，再展开推导和结论。','correct');
      } else {
        hideResult();
        feedback(c.hints[answer],'retry');
      }
    } else if ('mcView' in b.dataset && solved) {
      const selected = Number(b.dataset.mcView);
      view = c.presets ? [...c.presets[selected]] : selected;
      draw(c.viewsChangeAnalysis);
    }
  });
  ranges.forEach((input,i) => input.addEventListener('input',() => {
    if (!solved) return;
    view[i] = Number(input.value);
    draw(true);
  }));
  reset();
  root.querySelector('.mc-static').before(ui);
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-method-case]').forEach(mount);
