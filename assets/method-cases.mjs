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

const cases = {
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

const buttons = (options,kind) => options.map((text,i) => `<button type="button" data-mc-${kind}="${i}" aria-pressed="false">${text}</button>`).join('');
const group = (name,buttons) => `<div class="mc-buttons" role="group" aria-label="${name}">${buttons}</div>`;
function setPressed(ui,kind,active) {
  ui.querySelectorAll('[data-mc-'+kind+']').forEach((b,i) => b.setAttribute('aria-pressed',String(i===active)));
}

function mount(root) {
  const c = cases[root.dataset.methodCase];
  if (!c) return;
  const ui = document.createElement('div');
  ui.innerHTML = `<p class="mc-stage">① 先选情境，再判断</p>
    ${group('选择情境',buttons(c.scenarios.map(s=>s[0]),'scenario'))}
    <p class="mc-story" aria-live="polite"></p><p><b>${c.question}</b></p>
    ${group('选择统计方法',buttons(c.choices,'answer'))}
    <p class="mc-feedback" role="status"></p>
    <div class="mc-output" hidden><p class="mc-stage">② 操作图形，核对你的判断</p>
    ${group('改变图形显示',buttons(c.views,'view'))}
    <figure class="mc-figure"><div class="mc-chart"></div><figcaption class="mc-reading"></figcaption></figure>
    <div class="mc-evidence" aria-live="polite"></div>
    <details class="mc-derivation"><summary>③ 展开 LaTeX 推导与结论</summary><div class="mc-calculation"></div></details></div>`;
  const get = cls => ui.querySelector('.mc-'+cls);
  let scenario = 0, view = 0, solved = false;
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
    view = 0;
    hideResult();
    setPressed(ui,'scenario',scenario);
    setPressed(ui,'answer',-1);
    get('story').textContent = c.scenarios[scenario][1];
    feedback('选一个方法，答对后打开图和解析。');
  }
  function draw(includeDerivation) {
    const next = c.render(scenario,view);
    setPressed(ui,'view',view);
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
      view = Number(b.dataset.mcView);
      draw(false);
    }
  });
  reset();
  root.querySelector('.mc-static').before(ui);
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-method-case]').forEach(mount);
