import { seeded, randomNormal, studentCDF, studentQuantile } from './math.mjs';

export const STUDENT_LIMIT = 500;
const population = { mean: 10, sigma: 2 }, seed = 4405, levels = [.90, .95, .99];
const methodNames = ['已知 σ + z（模拟基准）', 'z 临界值 + 样本 S（近似）', 't 临界值 + 样本 S'];
// qnorm((1+level)/2) for the three supported confidence levels.
const zCritical = { .9: 1.6448536269514722, .95: 1.959963984540054, .99: 2.5758293035489004 };
const display = value => value === null ? '未定义' : value === 0 ? '0' : Math.abs(value) < .0001 ? value.toExponential(4) : Number(value.toPrecision(7)).toString();
const percent = value => value === null ? '尚无' : `${Number((100 * value).toFixed(4))}%`;
function validN(n) { if (!Number.isInteger(n) || n < 3 || n > 50) throw Error('每组样本数 n 须为 3–50 的整数。'); return n; }
function validLevel(level) { if (!levels.includes(level)) throw Error('置信水平请选择 90%、95% 或 99%。'); return level; }
const theoryCache = new Map();
export function studentTheory(n, level = .95) {
  validN(n); validLevel(level); const key = `${n}/${level}`;
  if (!theoryCache.has(key)) {
    const df = n - 1, z = zCritical[level], t = studentQuantile((1 + level) / 2, df);
    theoryCache.set(key, { n, df, level, zCritical: z, tCritical: t, knownCoverage: level, naiveCoverage: 2 * studentCDF(z, df) - 1, tCoverage: level });
  }
  return { ...theoryCache.get(key) };
}
function moments(values) {
  if (!Array.isArray(values)) throw Error('需要一组完整的有限原始观测。'); validN(values.length);
  if (values.some(value => !Number.isFinite(value) || Math.abs(value) > 1e6)) throw Error('原始观测须为有限数值，绝对值不超过 1e6。');
  const n = values.length, sum = values.reduce((a, b) => a + b, 0), mean = sum / n;
  const ss = values.reduce((total, value) => total + (value - mean) ** 2, 0), s = Math.sqrt(ss / (n - 1));
  const knownSE = population.sigma / Math.sqrt(n), estimatedSE = s / Math.sqrt(n);
  return { values: [...values], n, sum, mean, ss, s, knownSE, estimatedSE, Z: (mean - population.mean) / knownSE, T: s > 0 ? (mean - population.mean) / estimatedSE : null };
}
function applyTheory(sample, theory) {
  const intervals = [
    { key: 'known', critical: theory.zCritical, se: sample.knownSE, available: true },
    { key: 'naive', critical: theory.zCritical, se: sample.estimatedSE, available: sample.s > 0 },
    { key: 'student', critical: theory.tCritical, se: sample.estimatedSE, available: sample.s > 0 }
  ].map((method, i) => {
    const halfWidth = method.available ? method.critical * method.se : null;
    const low = method.available ? sample.mean - halfWidth : null, high = method.available ? sample.mean + halfWidth : null;
    return { ...method, name: methodNames[i], halfWidth, low, high, covers: method.available ? low <= population.mean && high >= population.mean : null };
  });
  return { ...sample, values: [...sample.values], theory: { ...theory }, population: { ...population }, intervals };
}
export function studentSummary(values, level = .95) { return applyTheory(moments(values), studentTheory(values.length, level)); }

export function createStudentSimulation(initialN = 5, initialLevel = .95) {
  let n = validN(initialN), level = validLevel(initialLevel), rng = seeded(seed), samples = [], selected = null;
  const snapshot = () => {
    const theory = studentTheory(n, level), records = samples.map(sample => applyTheory(sample, theory));
    const coverage = methodNames.map((name, i) => {
      const valid = records.filter(record => record.intervals[i].available).length;
      const hits = records.filter(record => record.intervals[i].covers === true).length;
      return { name, hits, valid, total: records.length, rate: records.length && valid === records.length ? hits / records.length : null,
        theoretical: [theory.knownCoverage, theory.naiveCoverage, theory.tCoverage][i] };
    });
    return { n, level, B: samples.length, totalObservations: n * samples.length, selected, current: selected === null ? null : records[selected], records, coverage, theory, seed, limit: STUDENT_LIMIT, remaining: STUDENT_LIMIT - samples.length };
  };
  return {
    snapshot,
    reset(nextN = n) { validN(nextN); n = nextN; rng = seeded(seed); samples = []; selected = null; return snapshot(); },
    setLevel(nextLevel) { validLevel(nextLevel); level = nextLevel; return snapshot(); },
    select(index) { if (!Number.isInteger(index) || index < 0 || index >= samples.length) throw Error('选择的样本序号超出本轮已抽样范围。'); selected = index; return snapshot(); },
    draw(requested = 1) {
      if (!Number.isInteger(requested) || requested < 1 || requested > STUDENT_LIMIT) throw Error('每次请增加 1–500 组样本。');
      const added = Math.min(requested, STUDENT_LIMIT - samples.length);
      for (let b = 0; b < added; b++) samples.push(moments(Array.from({ length: n }, () => population.mean + population.sigma * randomNormal(rng))));
      if (added) selected = samples.length - 1;
      return { ...snapshot(), added };
    }
  };
}

export function studentRCode(values, level = .95) {
  studentSummary(values, level);
  return `# Only the currently selected sample, copied without drawing new values.
y <- c(${values.join(', ')})
mu <- 10
sigma <- 2
level <- ${level}
n <- length(y)
df <- n-1
ybar <- mean(y)
S <- sd(y)
known_SE <- sigma/sqrt(n)
estimated_SE <- S/sqrt(n)
zcrit <- qnorm((1+level)/2)
tcrit <- qt((1+level)/2,df)
Z <- (ybar-mu)/known_SE
T <- if (S>0) (ybar-mu)/estimated_SE else NA_real_
intervals <- rbind(known_sigma_z=ybar+c(-1,1)*zcrit*known_SE,
                   sample_S_z_approx=if (S>0) ybar+c(-1,1)*zcrit*estimated_SE else c(NA,NA),
                   sample_S_t=if (S>0) ybar+c(-1,1)*tcrit*estimated_SE else c(NA,NA))
colnames(intervals) <- c("lower","upper")
coverage <- c(level,2*pt(zcrit,df)-1,level)
print(data.frame(observation=seq_along(y),value=y),digits=12)
print(c(n=n,mean=ybar,S=S,known_SE=known_SE,estimated_SE=estimated_SE,
        Z_centered_at_mu_10=Z,T_centered_at_mu_10=T,df=df))
print(data.frame(method=rownames(intervals),intervals,
                 covers_fixed_mu=intervals[,1]<=mu & intervals[,2]>=mu,
                 theoretical_coverage=coverage),digits=12)
# The population is iid Normal(mu=10,sigma=2). The simulator knows these
# parameters to check coverage; a real unknown-sigma procedure uses S, not 2.
# For S>0 the t interval is wider than z-with-S on the same sample, but it
# need not be wider than the known-sigma z interval because S varies.
# Theoretical rates are long-run coverage, not a probability for mu given
# this particular interval. This code does not recreate the saved history
# and makes no claim that R's RNG uses the browser's seed sequence.`;
}

export function studentIntervalGeometry(summary) {
  const endpoints = summary.intervals.filter(method => method.available).flatMap(method => [method.low, method.high]);
  const minimum = Math.min(population.mean, ...endpoints), maximum = Math.max(population.mean, ...endpoints), span = maximum - minimum;
  const padding = Math.max(span * .1, .05), low = minimum - padding, high = maximum + padding;
  const x = value => 155 + (value - low) / (high - low) * 475;
  const step = (high - low) / 4, decimals = Math.max(0, 1 - Math.floor(Math.log10(step)));
  const ticks = Array.from({ length: 5 }, (_, i) => ({ x: x(low + i * step), text: String(Number((low + i * step).toFixed(decimals))) }));
  return { low, high, x, ticks };
}
const ns = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const element = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.textContent = text; svg.append(element); return element;
}
export function drawStudentIntervals(svg, summary) {
  svg.replaceChildren();
  if (!summary) { svg.setAttribute('aria-label', '尚无样本区间'); return; }
  const g = studentIntervalGeometry(summary);
  add(svg, 'line', { x1: 155, x2: 630, y1: 256, y2: 256, stroke: '#50655f' });
  add(svg, 'line', { x1: g.x(population.mean), x2: g.x(population.mean), y1: 30, y2: 232, stroke: '#50655f', 'stroke-dasharray': '3 4', 'data-stu-truth': '10' });
  add(svg, 'text', { x: g.x(population.mean), y: 20, 'text-anchor': 'middle', class: 'stu-label' }, 'μ=10');
  for (const tick of g.ticks) add(svg, 'text', { x: tick.x, y: 285, 'text-anchor': 'middle', class: 'stu-tick' }, tick.text);
  for (const [i, method] of summary.intervals.entries()) {
    const y = 65 + i * 65; add(svg, 'text', { x: 138, y: y + 6, 'text-anchor': 'end', class: 'stu-label' }, ['已知 σ + z', 'S + z', 'S + t'][i]);
    if (!method.available) { add(svg, 'text', { x: 175, y: y + 6, class: 'stu-label' }, 'S=0：未定义'); continue; }
    const color = method.covers ? '#086f68' : '#9a472e';
    add(svg, 'line', { x1: g.x(method.low), x2: g.x(method.high), y1: y, y2: y, stroke: color, 'stroke-width': 4, 'stroke-dasharray': method.covers ? '' : '5 4', 'data-stu-interval': method.key });
    for (const endpoint of [method.low, method.high]) add(svg, 'line', { x1: g.x(endpoint), x2: g.x(endpoint), y1: y - 7, y2: y + 7, stroke: color, 'stroke-width': 2 });
    add(svg, 'circle', { cx: g.x(summary.mean), cy: y, r: 5, fill: '#183a37', 'data-stu-mean': method.key });
  }
  svg.setAttribute('aria-label', `同一组原始数据的三个双侧区间，共用横轴；中心均为 ${display(summary.mean)}，固定真值 μ=10。${summary.intervals.map(method => `${method.name}：${method.available ? `[${display(method.low)},${display(method.high)}]，${method.covers ? '覆盖' : '不覆盖'} μ` : 'S=0，未定义'}`).join('；')}。`);
}

export function mountStudent(root) {
  if (root.dataset.studentReady) return;
  root.classList.add('stu-lab');
  root.innerHTML = `<h3>同一组样本：σ 换成 S 后，区间哪里改变？</h3><p>固定教学总体为 <b>Normal(μ=10, σ=2)</b>，每组独立抽 n 个原始观测。模拟器知道真值是为了核对覆盖；现实中未知 σ 的方法使用本组样本 SD=S，不会凭空知道这个 2。</p>
    <div class="stu-controls"><label>每组观测数 n：<output data-stu-n-value>5</output><input type="range" min="3" max="50" step="1" value="5" data-stu-n></label><label>双侧置信水平<select data-stu-level><option value="0.9">90%</option><option value="0.95" selected>95%</option><option value="0.99">99%</option></select></label></div>
    <div class="stu-actions"><button type="button" data-stu-action="one">抽 1 组</button><button type="button" data-stu-action="hundred">重复 100 组</button><button type="button" class="secondary" data-stu-action="reset">重置本轮</button></div>
    <p class="stu-error" data-stu-error role="alert"></p><p class="stu-readout" data-stu-status role="status"></p>
    <p class="stu-note">n 是每组的观测数，B 是已抽的组数；共生成 n×B 个原始值。Seed=4405，每轮最多 500 组，达到后保留全部结果。改变 n 或重置会清空本轮；改变置信水平只重算同一批样本，不重新抽样。没有自动播放。</p>
    <div data-stu-valid><h4>本轮的覆盖数与理论覆盖率</h4><p class="stu-note">有限模拟不必恰好达到理论率；这里的“覆盖”指区间是否包含固定真值 10。窄屏可在表内横向滚动。</p>
    <div class="stu-table-wrap" tabindex="0" role="region" aria-label="三种方法的累计覆盖与理论率，可横向滚动"><table><thead><tr><th scope="col">方法</th><th scope="col">覆盖数 / B</th><th scope="col">有限模拟覆盖率</th><th scope="col">理论长期覆盖率</th></tr></thead><tbody>${methodNames.map((name, i) => `<tr><th scope="row">${name}</th><td data-stu-count="${i}"></td><td data-stu-rate="${i}"></td><td data-stu-theory="${i}"></td></tr>`).join('')}</tbody></table></div>
    <p data-stu-theory-note></p>
    <label class="stu-selector">查看已抽的某一组 <output data-stu-index></output><input type="range" min="1" max="1" step="1" value="1" data-stu-select disabled></label>
    <div data-stu-current hidden><h4>从本组原始数据算出两个标准误</h4><details><summary>查看本组 n 个原始观测</summary><ol class="stu-values" data-stu-values></ol><p class="stu-note">显示值经过四舍五入；R 代码保留本组完整数值。</p></details>
    <p data-stu-calculation></p><p class="stu-readout" data-stu-pivots></p>
    <figure><svg data-stu-plot viewBox="0 0 680 315" role="img"></svg><figcaption>同一组的三个区间使用同一横轴；圆点都是本组均值。实线表示覆盖 μ=10，虚线表示未覆盖；换组时视窗可缩放。一个区间是否覆盖，不是它自身拥有的“μ 落入概率”。</figcaption></figure>
    <div class="stu-intervals" data-stu-intervals></div>
    <p class="stu-note">同一组 S&gt;0 时，t 临界值比 z 大，所以 t+S 区间更宽；但 S 本身随样本变化，t+S 不一定比已知 σ 的 z 区间宽。S=0 时，依赖 S 的统计量与常规推断无法定义。</p></div></div>
    <details><summary>复制当前选中样本到 base R 核对</summary><button type="button" class="secondary" data-stu-copy disabled>复制当前 R 代码</button><pre data-stu-code></pre><p class="stu-note" data-stu-copy-status role="status"></p></details>
    <p class="stu-note">独立正态、非零总体 variance 下，Z=(ȳ−10)/(2/√n) 服从标准正态，T=(ȳ−10)/(S/√n) 服从 df=n−1 的 t 分布。z+S 是大样本近似，有限 n 时不能把它当成精确标称覆盖；非正态总体下，t 区间也不自动精确。理论长期覆盖率不是给定本次数据后 μ 落入区间的概率。</p>`;
  const $ = selector => root.querySelector(selector), nInput = $('[data-stu-n]'), levelInput = $('[data-stu-level]'), selector = $('[data-stu-select]');
  const one = $('[data-stu-action="one"]'), hundred = $('[data-stu-action="hundred"]'), copy = $('[data-stu-copy]');
  const simulation = createStudentSimulation(); let revision = 0;
  const read = () => { const raw = nInput.value.trim(); if (!/^\d+$/.test(raw)) throw Error('每组样本数 n 须为 3–50 的整数。'); return { n: validN(Number(raw)), level: validLevel(Number(levelInput.value)) }; };
  function render(state) {
    revision++; $('[data-stu-error]').textContent = ''; nInput.setAttribute('aria-invalid', 'false'); levelInput.setAttribute('aria-invalid', 'false'); $('[data-stu-valid]').hidden = false;
    $('[data-stu-copy-status]').textContent = ''; $('[data-stu-n-value]').textContent = String(state.n);
    $('[data-stu-status]').textContent = `n=${state.n} 个观测/组；B=${state.B} 组；nB=${state.totalObservations} 个原始观测。${state.added ? `本次新增 ${state.added} 组。` : ''}${state.remaining === 0 ? '已达本轮 500 组上限；结果已保留。' : ''}`;
    one.disabled = hundred.disabled = state.remaining === 0;
    hundred.textContent = state.remaining === 0 ? '已达 500 组上限' : state.remaining < 100 ? `重复剩余 ${state.remaining} 组` : '重复 100 组';
    state.coverage.forEach((method, i) => { $(`[data-stu-count="${i}"]`).textContent = `${method.hits}/${state.B}${method.valid < state.B ? `；${state.B - method.valid} 组未定义` : ''}`; $(`[data-stu-rate="${i}"]`).textContent = percent(method.rate); $(`[data-stu-theory="${i}"]`).textContent = percent(method.theoretical); });
    $('[data-stu-theory-note]').textContent = `独立正态模型下：已知 σ 的 z 与使用 S 的 t 均有理论覆盖率 ${percent(state.level)}。z+S 的理论率为 2Fₜ(${display(state.theory.zCritical)}；df=${state.n - 1})−1=${percent(state.theory.naiveCoverage)}；这不是当前 B 组的模拟结果。`;
    selector.disabled = !state.B; selector.max = String(Math.max(1, state.B)); selector.value = String(state.selected === null ? 1 : state.selected + 1);
    $('[data-stu-index]').textContent = state.B ? `第 ${state.selected + 1} / ${state.B} 组` : '尚无样本'; $('[data-stu-current]').hidden = !state.current;
    const sample = state.current;
    drawStudentIntervals($('[data-stu-plot]'), sample);
    if (sample) {
      $('[data-stu-values]').innerHTML = sample.values.map((value, i) => `<li><span>Y${i + 1}</span> <code>${Number(value.toPrecision(10))}</code></li>`).join('');
      $('[data-stu-calculation]').textContent = `第 ${state.selected + 1} 组：ΣY=${display(sample.sum)}，ȳ=ΣY/n=${display(sample.mean)}；Σ(Y−ȳ)²=${display(sample.ss)}，S=√[${display(sample.ss)}/(${sample.n}−1)]=${display(sample.s)}。`;
      $('[data-stu-pivots]').textContent = `总体 σ 固定为 2，已知 SE=2/√${sample.n}=${display(sample.knownSE)}；本组 S=${display(sample.s)}，估计 SE=S/√${sample.n}=${display(sample.estimatedSE)}。Z=(ȳ−10)/已知 SE=${display(sample.Z)}；T=(ȳ−10)/估计 SE=${display(sample.T)}，df=${sample.n - 1}。`;
      $('[data-stu-intervals]').innerHTML = sample.intervals.map(method => `<p><b>${method.name}</b>：${method.available ? `ȳ ± ${display(method.critical)} × ${display(method.se)} = [${display(method.low)}, ${display(method.high)}]；${method.covers ? '覆盖' : '未覆盖'} μ=10。` : 'S=0，未定义。'}</p>`).join('');
      $('[data-stu-code]').textContent = studentRCode(sample.values, state.level); copy.disabled = false;
    } else {
      for (const key of ['values', 'calculation', 'pivots', 'intervals', 'code']) $('[data-stu-' + key + ']').textContent = ''; copy.disabled = true;
    }
  }
  function errorState(error) {
    revision++; $('[data-stu-error]').textContent = error.message + ' 请修正设置；当前不显示旧结果。'; $('[data-stu-valid]').hidden = true;
    nInput.setAttribute('aria-invalid', 'true'); levelInput.setAttribute('aria-invalid', 'true'); one.disabled = hundred.disabled = selector.disabled = copy.disabled = true;
    $('[data-stu-status]').textContent = '等待有效的 n 与置信水平。'; $('[data-stu-code]').textContent = ''; $('[data-stu-copy-status]').textContent = ''; drawStudentIntervals($('[data-stu-plot]'), null);
  }
  const draw = count => { try { const settings = read(); if (simulation.snapshot().n !== settings.n) simulation.reset(settings.n); simulation.setLevel(settings.level); render(simulation.draw(count)); } catch (error) { errorState(error); } };
  const reset = () => { try { const settings = read(); simulation.setLevel(settings.level); render(simulation.reset(settings.n)); } catch (error) { errorState(error); } };
  nInput.addEventListener('input', reset);
  levelInput.addEventListener('change', () => { try { const settings = read(); if (simulation.snapshot().n !== settings.n) simulation.reset(settings.n); render(simulation.setLevel(settings.level)); } catch (error) { errorState(error); } });
  selector.addEventListener('input', () => { try { read(); render(simulation.select(Number(selector.value) - 1)); } catch (error) { errorState(error); } });
  one.addEventListener('click', () => draw(1)); hundred.addEventListener('click', () => draw(100)); $('[data-stu-action="reset"]').addEventListener('click', reset);
  copy.addEventListener('click', async () => { const version = revision, code = $('[data-stu-code]').textContent; try { await navigator.clipboard.writeText(code); if (version === revision) $('[data-stu-copy-status]').textContent = '已复制当前选中组的原始值与三种区间；不包含本轮其他样本。'; } catch { if (version === revision) $('[data-stu-copy-status]').textContent = '无法自动复制；请选中上方完整代码复制。'; } });
  render(simulation.snapshot()); root.dataset.studentReady = 'true';
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-student]').forEach(mountStudent);
