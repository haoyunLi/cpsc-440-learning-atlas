import * as M from './math.mjs';

const sum = values => values.reduce((a, b) => a + b, 0);
const format = value => Math.abs(value) > 0 && Math.abs(value) < .0001 ? value.toExponential(3) : Number(value.toFixed(5)).toString();
export function parseCoefficient(raw) {
  const s = String(raw).trim().replace(/−/g, '-');
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  if (!new RegExp(`^${number}(?:\\s*/\\s*${number})?$`).test(s)) throw Error('系数请输入数字或分数，例如 1、-0.5、-1/3。');
  const parts = s.split('/').map(Number);
  const value = parts.length === 2 ? parts[0] / parts[1] : parts[0];
  if (!Number.isFinite(value) || Math.abs(value) > 30) throw Error('系数必须是 −30 到 30 的有限数，分母不能为 0。');
  return value;
}

export function contrastSummary({ means, sizes, weights, mse, alpha = .05, method = 'individual', family = 4 }) {
  const k = means.length;
  if (k !== 4 || sizes.length !== k || weights.length !== k || means.some(x => !Number.isFinite(x) || Math.abs(x) > 10000) || sizes.some(x => !Number.isInteger(x) || x < 2 || x > 100) || weights.some(x => !Number.isFinite(x) || Math.abs(x) > 30)) throw Error('请提供四组完整均值、每组 2–100 的整数样本量及有效系数。');
  if (!(mse > 0 && mse <= 10000) || !(alpha > 0 && alpha < .5) || !['individual', 'bonferroni', 'scheffe'].includes(method) || !Number.isInteger(family) || family < 1 || family > 50) throw Error('MSE 应大于 0 且不超过 10000；family 数须为 1–50 的整数。');
  const weightSum = sum(weights), weightScale = sum(weights.map(Math.abs));
  if (weightScale === 0) throw Error('至少一个系数应非零；全零向量没有需要估计的比较。');
  const isContrast = Math.abs(weightSum) <= 32 * Number.EPSILON * weightScale;
  if (method === 'scheffe' && !isContrast) throw Error('这里的 Scheffé 同时区间保护全部 contrasts。当前系数和不为 0，请改为 contrast，或使用单个区间 / 预定 family 的 Bonferroni。');
  const df = sum(sizes) - k, terms = weights.map((a, i) => a * means[i]);
  const estimate = sum(terms), varianceFactor = sum(weights.map((a, i) => a * a / sizes[i]));
  const se = Math.sqrt(mse * varianceFactor), t = estimate / se;
  const rawP = M.betaCDF(df / (df + t * t), df / 2, .5);
  let critical, adjustedP;
  if (method === 'scheffe') {
    let hi = 10;
    while (M.fCDF(hi, k - 1, df) < 1 - alpha) hi *= 2;
    critical = Math.sqrt((k - 1) * M.invert(x => M.fCDF(x, k - 1, df), 1 - alpha, 0, hi));
    adjustedP = M.betaCDF(df / (df + t * t), df / 2, (k - 1) / 2);
  } else {
    const comparisons = method === 'bonferroni' ? family : 1;
    critical = M.studentQuantile(1 - alpha / (2 * comparisons), df);
    adjustedP = Math.min(1, rawP * comparisons);
  }
  return { k, df, weightSum: isContrast ? 0 : weightSum, isContrast, terms, estimate, varianceFactor, se, t, rawP, adjustedP, critical,
    low: estimate - critical * se, high: estimate + critical * se,
    ss: isContrast ? estimate * estimate / varianceFactor : null };
}

export function contrastCovariance(a, b, sizes, mse) {
  const inner = sum(a.map((v, i) => v * b[i] / sizes[i]));
  const aa = sum(a.map((v, i) => v * v / sizes[i]));
  const bb = sum(b.map((v, i) => v * v / sizes[i]));
  return { inner, covariance: mse * inner, correlation: inner / Math.sqrt(aa * bb) };
}

export function contrastRCode({ means, sizes, weights, mse, alpha, method, family }) {
  return `# Teaching summaries for a one-way, independent, common-variance model\nmeans <- c(${means.join(', ')})\nn <- c(${sizes.join(', ')})\na <- c(${weights.join(', ')})\nMSE <- ${mse}\nalpha <- ${alpha}\ndf <- sum(n)-length(n)\nL <- sum(a*means)\nSE <- sqrt(MSE*sum(a^2/n))\nt_value <- L/SE\np_raw <- 2*pt(abs(t_value),df,lower.tail=FALSE)\n` +
    (method === 'scheffe' ? `# Simultaneous coverage for every contrast among these group means\nk <- length(n)\ncritical <- sqrt((k-1)*qf(1-alpha,k-1,df))\np_adjusted <- pf(t_value^2/(k-1),k-1,df,lower.tail=FALSE)\n` :
      `# ${method === 'bonferroni' ? 'Prespecified family of tests; not a count of significant results' : 'One prespecified comparison'}\nm <- ${method === 'bonferroni' ? family : 1}\ncritical <- qt(1-alpha/(2*m),df)\np_adjusted <- min(1,m*p_raw)\n`) +
    `c(estimate=L,SE=SE,df=df,t=t_value,p_raw=p_raw,p_adjusted=p_adjusted,\n  lower=L-critical*SE,upper=L+critical*SE)\n# A second contrast B compares group A with group B.\nb <- c(0,1,-1,0)\nc(weighted_inner=sum(a*b/n),estimated_covariance=MSE*sum(a*b/n))\n`;
}

const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') { const el = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); el.textContent = text; svg.append(el); }
function plot(root, r) {
  const contribution = root.querySelector('[data-plot=terms]'), interval = root.querySelector('[data-plot=interval]');
  contribution.replaceChildren(); interval.replaceChildren();
  const min = Math.min(0, ...r.terms), max = Math.max(0, ...r.terms), pad = Math.max(1, (max - min) * .14);
  const x = v => 130 + (v - min + pad) / (max - min + 2 * pad) * 420;
  add(contribution, 'line', { x1: x(0), x2: x(0), y1: 25, y2: 232, stroke: '#50655f', 'stroke-dasharray': '4 3' });
  ['Control', 'A', 'B', 'C'].forEach((name, i) => {
    const y = 48 + i * 50, term = r.terms[i];
    add(contribution, 'text', { x: 14, y: y + 5, class: 'wbench-label' }, name);
    add(contribution, 'rect', { x: Math.min(x(0), x(term)), y: y - 11, width: Math.max(1, Math.abs(x(term) - x(0))), height: 22, fill: term < 0 ? '#9a472e' : '#086f68' });
    add(contribution, 'text', { x: 610, y: y + 5, 'text-anchor': 'end', class: 'wbench-label' }, format(term));
  });
  add(contribution, 'text', { x: 320, y: 265, 'text-anchor': 'middle', class: 'wbench-label' }, '每组贡献 aᵢ × meanᵢ；带符号相加得到 L̂');
  // Keep a distant null value from compressing a narrow interval into a dot.
  // Include zero when it fits without more than doubling the displayed span.
  const intervalSpan = r.high - r.low;
  const includeZero = Math.max(r.high, 0) - Math.min(r.low, 0) <= 2 * intervalSpan;
  const low = includeZero ? Math.min(r.low, 0) : r.low, high = includeZero ? Math.max(r.high, 0) : r.high;
  const margin = Math.max((high - low) * .18, 64 * Number.EPSILON * Math.max(1, Math.abs(r.estimate)));
  const cx = v => 70 + (v - low + margin) / (high - low + 2 * margin) * 500;
  add(interval, 'line', { x1: 70, x2: 570, y1: 135, y2: 135, stroke: '#50655f' });
  const zeroVisible = low - margin <= 0 && high + margin >= 0;
  if (zeroVisible) {
    add(interval, 'line', { x1: cx(0), x2: cx(0), y1: 24, y2: 146, stroke: '#9a472e', 'stroke-dasharray': '5 4' });
    add(interval, 'text', { x: cx(0), y: 169, 'text-anchor': 'middle', class: 'wbench-label' }, '0');
  } else {
    add(interval, 'text', { x: 320, y: 169, 'text-anchor': 'middle', class: 'wbench-label' }, `区间局部视窗；0 在${low > 0 ? '左侧图外 ←' : '右侧图外 →'}`);
  }
  interval.setAttribute('aria-label', `线性组合估计 ${format(r.estimate)}，置信区间 [${format(r.low)}, ${format(r.high)}]。${zeroVisible ? '图中虚线标出零。' : `局部放大区间；零在${low > 0 ? '左' : '右'}侧图外。`}`);
  add(interval, 'line', { x1: cx(r.low), x2: cx(r.high), y1: 77, y2: 77, stroke: '#086f68', 'stroke-width': 5 });
  for (const v of [r.low, r.high]) {
    add(interval, 'line', { x1: cx(v), x2: cx(v), y1: 65, y2: 89, stroke: '#086f68', 'stroke-width': 2 });
    add(interval, 'text', { x: cx(v), y: 112, 'text-anchor': 'middle', class: 'wbench-label' }, format(v));
  }
  add(interval, 'circle', { cx: cx(r.estimate), cy: 77, r: 6, fill: '#183a37' });
  add(interval, 'text', { x: 320, y: 199, 'text-anchor': 'middle', class: 'wbench-label' }, '点是估计 L̂；线段是当前方法的区间');
}

function mount(root) {
  root.classList.add('wbench');
  const input = (id, value, label) => `<label>${label}<input data-contrast=${id} value='${value}' inputmode=decimal></label>`;
  root.innerHTML = `<h2>从一个科学问题到 contrast 的区间</h2><p>四个独立组的原创汇总示例。假设各组正态、共同 variance，单因子模型 error df = Σnᵢ − 4。先确定研究问题和比较 family，再读结果。每个设定都保留在本页。</p>
  <div class=wbench-controls><label>先选一个研究问题<select data-contrast=preset><option value=control>Control − 三种处理的平均</option><option value=pair>A − B</option><option value=average>三种处理平均（不是 contrast）</option><option value=custom>自定义系数（在下方编辑）</option></select></label><label>区间与双侧检验<select data-contrast=method><option value=individual>单个预定问题：普通 t</option><option value=bonferroni>预定 family：Bonferroni</option><option value=scheffe>全部 contrasts：Scheffé</option></select></label>${input('mse',4,'共同 MSE')}${input('family',3,'预定 family 中的全部问题数 m')}<label>α<select data-contrast=alpha><option value=.05>0.05</option><option value=.01>0.01</option><option value=.1>0.10</option></select></label><label>全部系数同时乘以<select data-contrast=scale><option value=1>1</option><option value=3>3</option><option value=-1>−1：反转方向</option></select></label><label>全部组均值一起平移 <output data-shift-value>0</output><input type=range data-contrast=shift min=-10 max=10 step=1 value=0></label></div>
  <div class=contrast-grid>${['Control','A','B','C'].map((name,i)=>`<fieldset><legend>${name}</legend>${input('mean'+i,[10,12,14,16][i],'组均值')}${input('n'+i,4,'样本量 nᵢ')}${input('a'+i,i?'−1/3':'1','系数 aᵢ（支持分数）')}</fieldset>`).join('')}</div>
  <p class=wbench-note>系数、样本量均可直接编辑。图和计算使用“输入均值 + 平移”及“输入系数 × 倍数”。MSE 是共同模型误差项，不能由组均值本身估计。</p><p class=wbench-error role=alert></p>
  <div class=wbench-result data-result aria-live=polite></div><svg data-plot=terms viewBox='0 0 640 290' role=img aria-label='各组带符号的线性组合贡献'></svg><svg data-plot=interval viewBox='0 0 640 220' role=img aria-label='线性组合估计及其置信区间，与零比较'></svg>
  <p data-covariance class=wbench-note></p><details><summary>操作挑战：先预测，再改变一个设定</summary><ol><li>全部均值加 10。Control−active average 是否改变？切换到“三种处理平均”再试一次。</li><li>把所有系数乘 3。Estimate 和 SE 都怎样改变？t、P 与拒绝结论是否改变？</li><li>保持 Control 对比，把 A 的 n 从 4 改成 8。为什么它与 A−B 的加权内积不再为 0？</li><li>保持数据，比较普通、Bonferroni 和 Scheffé 区间。先说清各自保护的 family，不按哪个显著来选方法。</li></ol></details>
  <details><summary>用 R 核对当前设置</summary><p>以下 base R 代码已包含当前汇总数据；浏览器不运行 R。</p><button class=secondary data-copy>复制当前 R 代码</button><p class=status data-copy-status role=status></p><pre><code data-r-code></code></pre></details><p><a href='chapters/09.html#contrast'>回看 contrast 计算</a> · <a href='chapters/09.html#procedures'>比较方法与保护范围</a> · <a href='chapters/09.html#orthogonal'>正交与 SS 分解</a></p>`;
  const read = key => root.querySelector(`[data-contrast=${key}]`);
  // Use keyboard minus in editable values, while mathematical labels may use Unicode.
  for (let i=1; i<4; i++) read('a'+i).value='-1/3';
  const code = root.querySelector('[data-r-code]'), copy = root.querySelector('[data-copy]');
  function update() {
    read('family').disabled=read('method').value!=='bonferroni';
    root.querySelector('[data-shift-value]').textContent=read('shift').value;
    root.querySelector('[data-copy-status]').textContent='';
    try {
      const numeric = key => { const s=read(key).value.trim(); if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) throw Error('请填入完整数字；样本量和 m 必须为整数。'); return Number(s); };
      const shift=numeric('shift'), scale=numeric('scale');
      const config={means:[0,1,2,3].map(i=>numeric('mean'+i)+shift),sizes:[0,1,2,3].map(i=>numeric('n'+i)),weights:[0,1,2,3].map(i=>parseCoefficient(read('a'+i).value)*scale),mse:numeric('mse'),alpha:numeric('alpha'),method:read('method').value,family:read('family').disabled?3:numeric('family')};
      const r=contrastSummary(config), covariance=contrastCovariance(config.weights,[0,1,-1,0],config.sizes,config.mse);
      const name={individual:'普通',bonferroni:'Bonferroni 同时',scheffe:'Scheffé 同时'}[config.method];
      root.querySelector('.wbench-error').textContent=''; copy.disabled=false;
      root.querySelector('[data-result]').innerHTML=`<strong>${r.isContrast?'Contrast':'一般线性组合'}：L̂ = ${format(r.estimate)}；SE = ${format(r.se)}</strong><span>有效 coefficients = [${config.weights.map(format).join(', ')}]；Σaᵢ = ${format(r.weightSum)}</span><span>df = ${r.df}；t = ${format(r.t)}；未经校正双侧 P = ${format(r.rawP)}</span><span>${name} ${Math.round((1-config.alpha)*100)}% CI = [${format(r.low)}, ${format(r.high)}]；${config.method==='individual'?'P':'adjusted P'} = ${format(r.adjustedP)}</span><span>本规则在 α=${config.alpha} 下${r.adjustedP<=config.alpha?'拒绝':'不拒绝'} L=0。${r.isContrast?`SScontrast = ${format(r.ss)}，1-df F=t²=${format(r.t*r.t)}；F 右尾对应双侧 t。`:'系数和非零，整体均值平移会改变此 estimand；不能把它当作 treatment contrast SS。'}</span><span>${config.method==='bonferroni'?`family 中预定 m=${config.family} 个问题；当前显示其中一个区间，未计算其他问题。`:config.method==='scheffe'?'保护这 4 组均值之间的全部 contrasts；乘数使用组数−1=3，不使用当前列出问题的数量。':'这是单个预定问题的区间，不自动保护查看过的全部比较。'}</span>`;
      root.querySelector('[data-covariance]').textContent=`与 b=[0,1,−1,0]（A−B）的加权内积 Σaᵢbᵢ/nᵢ=${format(covariance.inner)}；估计 covariance=${format(covariance.covariance)}，correlation=${format(covariance.correlation)}。正交要求内积为 0；共同正态模型下线性估计才由不相关推出独立。t/F 还共享估计 MSE，不能据此免去 family 校正。`;
      plot(root,r); code.textContent=contrastRCode(config);
    } catch(error) {
      root.querySelector('.wbench-error').textContent=error.message;root.querySelector('[data-result]').textContent='等待有效的研究问题与输入。';root.querySelector('[data-covariance]').textContent='';root.querySelectorAll('svg').forEach(svg=>svg.replaceChildren());code.textContent='';copy.disabled=true;
    }
  }
  read('preset').addEventListener('change',()=>{
    const values={control:['1','-1/3','-1/3','-1/3'],pair:['0','1','-1','0'],average:['0','1/3','1/3','1/3']}[read('preset').value];
    if(values){values.forEach((value,i)=>read('a'+i).value=value);read('scale').value='1';}
    update();
  });
  root.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',()=>{
    if(el===read('preset'))return;
    if(/^a\d$/.test(el.dataset.contrast))read('preset').value='custom';
    update();
  }));
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(code.textContent);root.querySelector('[data-copy-status]').textContent='已复制当前完整 R 代码。';}catch{root.querySelector('[data-copy-status]').textContent='浏览器未允许复制，请选择下方代码手动复制。';}});
  update();
}

if(typeof document!=='undefined')document.querySelectorAll('[data-contrast-lab]').forEach(mount);
