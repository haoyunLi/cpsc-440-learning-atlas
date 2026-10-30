import { regression, studentQuantile } from './math.mjs';

export const regressionDefaults = Object.freeze({ lastY: 26, x0: 4, level: .95, band: 'mean' });
const fixedX = [1, 3, 4, 5, 7];
const fixedY = [6, 14, 10, 14];
const criticals = new Map();
const show = value => value === 0 ? '0' : String(Number(value.toPrecision(7)));
function gridValue(value, low, high, step, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high || (value !== 0 && Math.round(value / step) === 0) || Math.abs(value / step - Math.round(value / step)) > 1e-10) throw Error(`${label} 须在 ${low}–${high} 之间，以 ${step} 为步长。`);
  return Math.round(value / step) * step;
}

export function regressionAnalysis(settings = {}) {
  const { lastY: rawLastY = 26, x0: rawX0 = 4, level = .95, band = 'mean' } = settings;
  const lastY = gridValue(rawLastY, 8, 40, .5, 'R5 的 Y');
  const x0 = Number(gridValue(rawX0, 0, 9, .1, '预测位置 x₀').toFixed(1));
  if (![.9, .95, .99].includes(level)) throw Error('置信水平请选择 90%、95% 或 99%。');
  if (!['mean', 'prediction'].includes(band)) throw Error('请选择 mean CI 或 individual PI。');
  const x = [...fixedX], y = [...fixedY, lastY], fit = regression(x, y), n = x.length, df = n - 2;
  if (!criticals.has(level)) criticals.set(level, studentQuantile((1 + level) / 2, df));
  const critical = criticals.get(level), baseline = 1 / n;
  function at(value) {
    const distance = (value - fit.xb) ** 2 / fit.sxx, h0 = baseline + distance;
    const estimate = fit.intercept + fit.slope * value;
    const interval = variance => {
      const se = Math.sqrt(variance), halfWidth = critical * se;
      return { variance, se, halfWidth, lower: estimate - halfWidth, upper: estimate + halfWidth };
    };
    return { estimate, distance, h0, mean: interval(fit.mse * h0), prediction: interval(fit.mse * (1 + h0)) };
  }
  const rows = x.map((xi, i) => ({ id: `R${i + 1}`, x: xi, y: y[i], fitted: fit.pred[i], residual: y[i] - fit.pred[i], squaredResidual: (y[i] - fit.pred[i]) ** 2 }));
  const curve = Array.from({ length: 91 }, (_, i) => {
    const value = i / 10, a = at(value);
    return { x: value, estimate: a.estimate, meanLower: a.mean.lower, meanUpper: a.mean.upper, predictionLower: a.prediction.lower, predictionUpper: a.prediction.upper };
  });
  return { lastY, x0, level, band, x, y, fit, n, df, critical, rows, baseline, ...at(x0), curve, extrapolation: x0 < 1 || x0 > 7 };
}

export function regressionGeometry(result) {
  // Outer limits depend on the complete fitted model and level, never the
  // selected x0 or emphasized interval. The PI encloses the mean CI.
  const low = Math.min(...result.curve.map(point => point.predictionLower), ...result.y);
  const high = Math.max(...result.curve.map(point => point.predictionUpper), ...result.y);
  const padding = Math.max(1, (high - low) * .075);
  const domain = { x: [0, 9], y: [low - padding, high + padding] };
  const frame = { left: 90, right: 650, top: 50, bottom: 330 };
  const x = value => frame.left + value / 9 * (frame.right - frame.left);
  const y = value => frame.bottom - (value - domain.y[0]) / (domain.y[1] - domain.y[0]) * (frame.bottom - frame.top);
  const profileX = value => frame.left + (value - domain.y[0]) / (domain.y[1] - domain.y[0]) * (frame.right - frame.left);
  const profileFrame = { left: 90, right: 650, rows: { mean: 75, prediction: 150 }, axis: 205 };
  return { domain, frame, profileFrame, x, y, profileX, points: result.rows.map(row => ({ id: row.id, x: x(row.x), y: y(row.y), fittedY: y(row.fitted) })) };
}

export function regressionRCode(input = {}) {
  const r = regressionAnalysis(input);
  return `# The five teaching observations shown in the browser, with R5 at its current Y.
d <- data.frame(id=paste0("R",1:5),x=c(1,3,4,5,7),
                y=c(6,14,10,14,${r.lastY}))
fit <- lm(y ~ x,data=d)
x0 <- ${r.x0}
level <- ${r.level}
n <- nrow(d)
xbar <- mean(d$x)
Sxx <- sum((d$x-xbar)^2)
error_df <- df.residual(fit)
mse <- deviance(fit)/error_df
critical <- qt((1+level)/2,df=error_df)
r <- cor(d$x,d$y)
r_squared <- summary(fit)$r.squared
baseline <- 1/n
distance <- (x0-xbar)^2/Sxx
h0 <- baseline+distance
yhat <- unname(coef(fit)[1]+coef(fit)[2]*x0)
variance_mean <- mse*h0
variance_new <- variance_mean+mse
SE_mean <- sqrt(variance_mean)
SE_new <- sqrt(variance_new)
manual_ci <- c(fit=yhat,lwr=yhat-critical*SE_mean,upr=yhat+critical*SE_mean)
manual_pi <- c(fit=yhat,lwr=yhat-critical*SE_new,upr=yhat+critical*SE_new)
new <- data.frame(x=x0)
ci <- predict(fit,newdata=new,interval="confidence",level=level)
pi <- predict(fit,newdata=new,interval="prediction",level=level)
d$fitted <- fitted(fit)
d$residual <- residuals(fit)
d$squared_residual <- d$residual^2
print(d,digits=12)
print(c(n=n,xbar=xbar,Sxx=Sxx,SSE=deviance(fit),MSE=mse,
        error_df=error_df,t_critical=critical,r=r,R_squared=r_squared,baseline=baseline,
        distance=distance,h0=h0,variance_mean=variance_mean,
        variance_new=variance_new,SE_mean=SE_mean,SE_new=SE_new),digits=12)
print(rbind(mean_CI=manual_ci,individual_PI=manual_pi),digits=12)
print(ci,digits=12)
print(pi,digits=12)
stopifnot(max(abs(manual_ci-as.numeric(ci)))<1e-10,
          max(abs(manual_pi-as.numeric(pi)))<1e-10,
          abs(SE_mean-predict(fit,newdata=new,se.fit=TRUE)$se.fit)<1e-10,
          abs(sum(d$squared_residual)-deviance(fit))<1e-10,
          abs(variance_new-variance_mean-mse)<1e-10,
          abs(r_squared-r^2)<1e-10)
# Both curves use the same data, confidence level, and plotting limits.
grid <- data.frame(x=seq(0,9,by=.1))
ci_grid <- predict(fit,newdata=grid,interval="confidence",level=level)
pi_grid <- predict(fit,newdata=grid,interval="prediction",level=level)
y_limits <- range(d$y,pi_grid[,c("lwr","upr")])
y_padding <- max(1,diff(y_limits)*.075)
y_limits <- y_limits+c(-y_padding,y_padding)
plot(d$x,d$y,xlim=c(0,9),ylim=y_limits,pch=19,
     xlab="x: mileage",ylab="Y: cost")
lines(grid$x,ci_grid[,"fit"])
matlines(grid$x,ci_grid[,c("lwr","upr")],col="darkgreen",lty=1)
matlines(grid$x,pi_grid[,c("lwr","upr")],col="brown",lty=2)
abline(v=x0,lty=3)
points(x0,yhat,pch=23,bg="black")
segments(x0,manual_pi["lwr"],x0,manual_pi["upr"],col="brown",lty=2)
segments(x0,manual_ci["lwr"],x0,manual_ci["upr"],col="darkgreen",lwd=2)
legend("topleft",c("Fitted mean","Mean CI","Individual PI"),
       col=c("black","darkgreen","brown"),lty=c(1,1,2),bty="n")
# These are pointwise intervals, not a simultaneous confidence band.
# Training residuals are not independent future observations for checking PI coverage.
# Changing R5 changes both the fitted line and MSE, not only residual noise.
# The normal linear model assumes independent errors and common variance;
# a future unit also has an independent error with that same variance.
# Values of x0 outside [1,7] extrapolate beyond the observed x range.
`;
}

const svgNS = 'http://www.w3.org/2000/svg';
function add(svg, tag, attrs, text = '') {
  const node = (svg.ownerDocument || document).createElementNS(svgNS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text) node.textContent = text;
  svg.append(node); return node;
}
function path(points, x, y, field) {
  return points.map((point, i) => `${i ? 'L' : 'M'}${x(point.x)},${y(point[field])}`).join(' ');
}
export function drawRegression(svg, result, type = 'main') {
  if (!['main', 'profile'].includes(type)) throw Error('未知的回归图类型。');
  const g = regressionGeometry(result), { left, right, top, bottom } = g.frame;
  svg.replaceChildren();
  svg.setAttribute('viewBox', type === 'main' ? '0 0 720 400' : '0 0 720 260');
  svg.setAttribute('data-reg-y-min', g.domain.y[0]); svg.setAttribute('data-reg-y-max', g.domain.y[1]);
  const levelText = `${Math.round(result.level * 100)}%`;
  if (type === 'profile') {
    add(svg, 'text', { x: left, y: 24, class: 'reg-label' }, `同一 x₀ = ${show(result.x0)}，共同中心 ŷ₀ = ${show(result.estimate)}`);
    for (const [kind, row] of [['mean', 75], ['prediction', 150]]) {
      const interval = result[kind], color = kind === 'mean' ? '#086f68' : '#9a472e';
      const lower = g.profileX(interval.lower), upper = g.profileX(interval.upper), center = g.profileX(result.estimate);
      add(svg, 'text', { x: left, y: row - 24, class: 'reg-label' }, kind === 'mean' ? `${levelText} mean CI · E(Y|x₀)` : `${levelText} individual PI · 新单位 Y`);
      add(svg, 'line', { x1: lower, x2: upper, y1: row, y2: row, stroke: color, 'stroke-width': result.band === kind ? 5 : 2.5, 'stroke-dasharray': kind === 'prediction' ? '8 5' : 'none', 'data-reg-profile': kind });
      for (const [which, value, pixel] of [['lower', interval.lower, lower], ['upper', interval.upper, upper]]) {
        add(svg, 'line', { x1: pixel, x2: pixel, y1: row - 8, y2: row + 8, stroke: color, 'stroke-width': 2, 'data-reg-endpoint': `${kind}:${which}` });
        add(svg, 'text', { x: pixel, y: row + 27, 'text-anchor': which === 'lower' ? 'end' : 'start', class: 'reg-tick' }, show(value));
      }
      add(svg, 'path', { d: `M${center},${row - 7}l7,7l-7,7l-7,-7Z`, fill: '#183a37', 'data-reg-center': kind });
    }
    add(svg, 'line', { x1: left, x2: right, y1: 205, y2: 205, class: 'reg-axis' });
    for (let i = 0; i <= 4; i++) {
      const value = g.domain.y[0] + i * (g.domain.y[1] - g.domain.y[0]) / 4, pixel = g.profileX(value);
      add(svg, 'line', { x1: pixel, x2: pixel, y1: 205, y2: 210, class: 'reg-axis' });
      add(svg, 'text', { x: pixel, y: 230, 'text-anchor': 'middle', class: 'reg-tick' }, String(Number(value.toFixed(1))));
    }
    add(svg, 'text', { x: (left + right) / 2, y: 255, 'text-anchor': 'middle', class: 'reg-label' }, '相同横轴：Y 的数值（原 cost 尺度）');
  } else {
    for (const [low, high] of [[0, 1], [7, 9]]) add(svg, 'rect', { x: g.x(low), y: top, width: g.x(high) - g.x(low), height: bottom - top, fill: '#f3eee7', 'data-reg-extrapolation': 'true' });
    for (let i = 0; i <= 4; i++) {
      const value = g.domain.y[0] + i * (g.domain.y[1] - g.domain.y[0]) / 4;
      add(svg, 'line', { x1: left, x2: right, y1: g.y(value), y2: g.y(value), class: 'reg-grid' });
      add(svg, 'text', { x: left - 12, y: g.y(value) + 5, 'text-anchor': 'end', class: 'reg-tick' }, String(Number(value.toFixed(1))));
    }
    for (const kind of ['prediction', 'mean']) {
      const lower = `${kind}Lower`, upper = `${kind}Upper`, color = kind === 'mean' ? '#086f68' : '#9a472e';
      const ribbon = path(result.curve, g.x, g.y, upper) + ' ' + path([...result.curve].reverse(), g.x, g.y, lower).replace(/^M/, 'L') + ' Z';
      add(svg, 'path', { d: ribbon, fill: color, opacity: kind === 'mean' ? .14 : .06, 'data-reg-ribbon': kind });
      for (const field of [lower, upper]) add(svg, 'path', { d: path(result.curve, g.x, g.y, field), fill: 'none', stroke: color, 'stroke-width': result.band === kind ? 2.5 : 1.5, 'stroke-dasharray': kind === 'prediction' ? '7 5' : 'none', 'data-reg-boundary': field });
    }
    add(svg, 'path', { d: path(result.curve, g.x, g.y, 'estimate'), fill: 'none', stroke: '#183a37', 'stroke-width': 2.5, 'data-reg-line': 'fitted' });
    add(svg, 'line', { x1: g.x(result.fit.xb), x2: g.x(result.fit.xb), y1: top, y2: bottom, stroke: '#9aa8a0', 'stroke-dasharray': '2 5', 'data-reg-line': 'xbar' });
    for (const point of g.points) {
      const row = result.rows.find(item => item.id === point.id);
      add(svg, 'line', { x1: point.x, x2: point.x, y1: point.y, y2: point.fittedY, stroke: '#778c83', 'stroke-dasharray': '3 3', 'data-reg-residual': point.id });
      const dot = add(svg, 'circle', { cx: point.x, cy: point.y, r: 5, fill: '#183a37', 'data-reg-point': point.id });
      add(dot, 'title', {}, `${point.id}：x=${row.x}，Y=${show(row.y)}，ŷ=${show(row.fitted)}，e=${show(row.residual)}`);
      add(svg, 'text', { x: point.x + 8, y: point.y - 8, class: 'reg-point-label' }, point.id);
    }
    const selectedX = g.x(result.x0);
    add(svg, 'line', { x1: selectedX, x2: selectedX, y1: top, y2: bottom, stroke: '#183a37', 'stroke-dasharray': '5 5', 'data-reg-line': 'x0' });
    for (const kind of ['prediction', 'mean']) {
      const interval = result[kind], color = kind === 'mean' ? '#086f68' : '#9a472e', cap = kind === 'mean' ? 7 : 12;
      add(svg, 'line', { x1: selectedX, x2: selectedX, y1: g.y(interval.lower), y2: g.y(interval.upper), stroke: color, 'stroke-width': result.band === kind ? 5 : 3, 'stroke-dasharray': kind === 'prediction' ? '6 4' : 'none', 'data-reg-slice': kind });
      for (const end of ['lower', 'upper']) add(svg, 'line', { x1: selectedX - cap, x2: selectedX + cap, y1: g.y(interval[end]), y2: g.y(interval[end]), stroke: color, 'stroke-width': 2, 'data-reg-cap': `${kind}:${end}` });
    }
    const centerY = g.y(result.estimate);
    add(svg, 'path', { d: `M${selectedX},${centerY - 7}l7,7l-7,7l-7,-7Z`, fill: '#183a37', stroke: 'white', 'stroke-width': 1.5, 'data-reg-predicted': 'true' });
    add(svg, 'line', { x1: left, x2: right, y1: bottom, y2: bottom, class: 'reg-axis' });
    add(svg, 'line', { x1: left, x2: left, y1: top, y2: bottom, class: 'reg-axis' });
    for (const value of [0, 1, 4, 7, 9]) add(svg, 'text', { x: g.x(value), y: bottom + 26, 'text-anchor': 'middle', class: 'reg-tick' }, String(value));
    add(svg, 'text', { x: left, y: 25, class: 'reg-label' }, 'Y: cost · 曲线为逐点区间');
    add(svg, 'text', { x: right, y: 25, 'text-anchor': 'end', class: 'reg-label' }, `x₀=${show(result.x0)} · ŷ₀=${show(result.estimate)}`);
    add(svg, 'text', { x: (left + right) / 2, y: 389, 'text-anchor': 'middle', class: 'reg-label' }, 'x: mileage · 灰色区间外推；x̄=4');
  }
  svg.setAttribute('aria-label', `${type === 'main' ? '回归线与两类逐点区间' : '相同 Y 尺度的区间剖面'}：x₀=${show(result.x0)}，ŷ₀=${show(result.estimate)}，${levelText} mean CI [${show(result.mean.lower)}, ${show(result.mean.upper)}]，individual PI [${show(result.prediction.lower)}, ${show(result.prediction.upper)}]。${result.extrapolation ? '当前位置属于外推。' : ''}`);
}

export function mountRegression(root) {
  if (root.dataset.regressionReady) return;
  root.classList.add('reg-lab');
  root.innerHTML = `<p class="reg-intro">Mean CI 估计总体条件平均值 E(Y|x₀)；individual PI 预测同一 x₀ 处一个独立新单位的 Y。先保持五个观测不变，只移动预测位置。</p>
  <div class="reg-controls">
    <label for="rx">预测位置 x₀ <output id="rx-v" aria-live="off"></output><input id="rx" type="range" min="0" max="9" step=".1" value="4"></label>
    <label for="ry">R5 在 x=7 的 Y <output id="ry-v" aria-live="off"></output><input id="ry" type="range" min="8" max="40" step=".5" value="26"></label>
    <label>区间置信水平<select data-reg-level><option value="0.9">90%</option><option value="0.95" selected>95%</option><option value="0.99">99%</option></select></label>
    <label for="band">强调哪个研究目标？<select id="band"><option value="mean">Mean CI：总体条件均值</option><option value="prediction">Individual PI：独立新个体</option></select></label>
  </div>
  <div class="reg-presets" aria-label="预测位置快捷选择"><button type="button" class="secondary" data-reg-position="4">中心 x₀=4</button><button type="button" class="secondary" data-reg-position="7">边界 x₀=7</button><button type="button" class="secondary" data-reg-position="8">外推 x₀=8</button></div>
  <div class="reg-actions"><button type="button" data-reg-play aria-pressed="false">播放预测位置</button><button type="button" class="secondary" data-reg-step>下一步 +0.1</button><button type="button" class="secondary" data-reg-reset>恢复原始设置</button></div>
  <p data-reg-motion class="reg-note" role="status">播放仅移动 x₀，五个观测和拟合线保持不变；到 9 自动停止。</p><p data-reg-error class="reg-error" role="alert"></p>
  <div data-reg-result class="reg-result"></div>
  <div class="reg-legend" aria-label="图例"><span class="reg-key mean">绿实线：mean CI</span><span class="reg-key prediction">棕虚线：individual PI</span><span>黑菱形：当前 ŷ₀</span></div>
  <div data-reg-visuals class="reg-visuals"><figure><svg data-reg-plot="main" viewBox="0 0 720 400" role="img"></svg><figcaption>同一数据和置信水平下，两类区间始终共用坐标。改变 x₀ 或强调目标不会缩放图面；竖向端点对应下方剖面。R1–R5 是已用于拟合的观测，不能把它们的 residuals 当成独立未来样本来检查 PI 覆盖率。</figcaption></figure><figure><svg data-reg-plot="profile" viewBox="0 0 720 260" role="img"></svg><figcaption>沿当前 x₀ 切开后，把两类区间放到相同 Y 横轴上比较。两者中心相同，PI 多包含一个新单位的 error variance。</figcaption></figure></div>
  <details class="reg-zoom"><summary>放大查看图与剖面（可横向滚动）</summary><div class="reg-scroll" tabindex="0" role="region" aria-label="放大的回归图，可横向滚动"><svg data-reg-zoom="main" viewBox="0 0 720 400" role="img"></svg><svg data-reg-zoom="profile" viewBox="0 0 720 260" role="img"></svg></div></details>
  <section class="reg-calculation"><h3>从预测位置到区间端点</h3><div data-reg-calculation></div></section>
  <p data-reg-boundary-note class="reg-note"></p><p class="reg-note">R5 的 Y 旋钮同时改变 fitted line 与 MSE，不是只改变 noise。区间取决于线性 conditional mean、独立正态 errors 与共同 variance；新单位的 error 也须独立并具有相同 variance。每个位置是 pointwise 区间，画成曲线不会变成整条曲线的同时置信带。</p>
  <details><summary>逐行核对五个观测与 residual squares</summary><div class="reg-scroll" tabindex="0" role="region" aria-label="完整回归数据，可横向滚动"><table><caption>Road 教学数据；R5 的 Y 可调整，五行始终保留</caption><thead><tr><th scope="col">ID</th><th scope="col">x</th><th scope="col">Y</th><th scope="col">fitted ŷ</th><th scope="col">residual e</th><th scope="col">e²</th></tr></thead><tbody>${[1, 2, 3, 4, 5].map(i => `<tr data-reg-row="R${i}"><th scope="row">R${i}</th>${['x', 'y', 'fitted', 'residual', 'squaredResidual'].map(key => `<td data-reg-cell="R${i}:${key}"></td>`).join('')}</tr>`).join('')}</tbody></table></div><p data-reg-sse class="reg-note"></p></details>
  <details><summary>用当前数据与预测位置在 R 中复现</summary><button type="button" class="secondary" data-reg-copy>复制当前 R 代码</button><pre data-reg-code></pre><p data-reg-copy-status class="reg-note" role="status"></p></details>`;
  const $ = selector => root.querySelector(selector), doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const xControl = $('#rx'), yControl = $('#ry'), levelControl = $('[data-reg-level]'), bandControl = $('#band');
  const play = $('[data-reg-play]'), step = $('[data-reg-step]'), copy = $('[data-reg-copy]');
  const reduced = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false, addEventListener() {} };
  const plots = ['main', 'profile'].flatMap(type => [{ type, svg: $(`[data-reg-plot="${type}"]`) }, { type, svg: $(`[data-reg-zoom="${type}"]`) }]);
  const presets = [...root.querySelectorAll('[data-reg-position]')];
  let result = null, timer = null, revision = 0, code = '', copyRequest = 0;
  function setPlayLabel() {
    play.textContent = timer !== null ? '暂停播放' : result?.x0 >= 9 ? '从 0 播放预测位置' : '播放预测位置';
    play.setAttribute('aria-pressed', String(timer !== null));
    play.disabled = reduced.matches || !result;
    play.title = reduced.matches ? '减少动态偏好已启用；请使用位置旋钮、快捷选择或下一步。' : '';
    step.disabled = !result || result.x0 >= 9;
  }
  function stop(message) {
    const wasPlaying = timer !== null;
    if (wasPlaying) clearInterval(timer);
    timer = null; setPlayLabel();
    if (message && wasPlaying) $('[data-reg-motion]').textContent = message;
  }
  function numeric(control) { return control.value.trim() === '' ? NaN : Number(control.value); }
  function render() {
    revision++; $('[data-reg-copy-status]').textContent = '';
    try {
      result = regressionAnalysis({ lastY: numeric(yControl), x0: numeric(xControl), level: numeric(levelControl), band: bandControl.value });
      $('[data-reg-error]').textContent = '';
      $('#rx-v').textContent = show(result.x0); $('#ry-v').textContent = show(result.lastY);
      const percent = Math.round(result.level * 100);
      $('[data-reg-result]').innerHTML = `<strong>x₀=${show(result.x0)} → ŷ₀=${show(result.estimate)}</strong><span class="${result.band === 'mean' ? 'reg-emphasis' : ''}">${percent}% mean CI：<b>[${show(result.mean.lower)}, ${show(result.mean.upper)}]</b> · 总体条件均值</span><span class="${result.band === 'prediction' ? 'reg-emphasis' : ''}">${percent}% individual PI：<b>[${show(result.prediction.lower)}, ${show(result.prediction.upper)}]</b> · 一个独立新单位</span>`;
      plots.forEach(({ type, svg }) => drawRegression(svg, result, type));
      $('[data-reg-calculation]').innerHTML = `<p>n=5，x̄=4，Sxx=20；ŷ=${show(result.fit.intercept)}+(${show(result.fit.slope)})x。SSE=${show(result.fit.sse)}，df=5−2=3，MSE=SSE/3=${show(result.fit.mse)}。Pearson r=${show(result.fit.r)}，R²=${show(result.fit.r2)}（含截距的 SLR）。</p><div class="reg-formula">h₀ = 1/5 + (${show(result.x0)}−4)²/20 = ${show(result.baseline)} + ${show(result.distance)} = <b>${show(result.h0)}</b></div><div class="reg-calculation-grid"><div><b>总体 mean 的估计 variance</b><p>MSE×h₀ = ${show(result.fit.mse)}×${show(result.h0)} = ${show(result.mean.variance)}<br>SE(mean) = √${show(result.mean.variance)} = <b>${show(result.mean.se)}</b></p></div><div><b>新个体的 prediction variance</b><p>MSE×h₀ + MSE = ${show(result.mean.variance)} + ${show(result.fit.mse)} = ${show(result.prediction.variance)}<br>SE(new) = √${show(result.prediction.variance)} = <b>${show(result.prediction.se)}</b></p></div></div><p>共同使用 t<sub>${show((1 + result.level) / 2)},3</sub> = ${show(result.critical)}。Mean CI 半宽=${show(result.critical)}×${show(result.mean.se)}=${show(result.mean.halfWidth)}；individual PI 半宽=${show(result.critical)}×${show(result.prediction.se)}=${show(result.prediction.halfWidth)}。两端都以 ŷ₀=${show(result.estimate)} 为中心。</p><p class="reg-note">先加 variance，再开平方。两类 variance 的差等于 MSE，不能把两个 SE 直接相加。</p>`;
      $('[data-reg-boundary-note]').textContent = result.extrapolation ? `当前 x₀=${show(result.x0)} 在观测范围 [1,7] 之外，属于 extrapolation。能算出区间不代表均值关系或误差模型在新范围仍适用。` : `当前 x₀=${show(result.x0)} 在观测范围 [1,7] 内。范围内预测同样需要检查模型条件。`;
      for (const row of result.rows) for (const key of ['x', 'y', 'fitted', 'residual', 'squaredResidual']) $(`[data-reg-cell="${row.id}:${key}"]`).textContent = show(row[key]);
      $('[data-reg-sse]').textContent = `五个 e² 相加得到 SSE=${show(result.fit.sse)}；估计 intercept 与 slope 后剩余 df=3，所以 MSE=${show(result.fit.mse)}。`;
      code = regressionRCode(result); $('[data-reg-code]').textContent = code; copy.disabled = false;
      presets.forEach(button => button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-reg-position')) === result.x0)));
    } catch (error) {
      result = null; code = ''; stop();
      $('[data-reg-error]').textContent = error.message;
      for (const name of ['result', 'calculation', 'boundary-note', 'sse', 'code']) $(`[data-reg-${name}]`).textContent = '';
      for (const { svg } of plots) { svg.replaceChildren(); svg.setAttribute('aria-label', '等待有效的回归设置。'); }
      for (let i = 1; i <= 5; i++) for (const key of ['x', 'y', 'fitted', 'residual', 'squaredResidual']) $(`[data-reg-cell="R${i}:${key}"]`).textContent = '—';
      copy.disabled = true;
    }
    setPlayLabel();
  }
  function manualChange() { stop('已暂停；现在显示手动选择的设置。'); render(); }
  for (const control of [xControl, yControl, levelControl, bandControl]) {
    control.addEventListener('input', manualChange); control.addEventListener('change', manualChange);
  }
  presets.forEach(button => button.addEventListener('click', () => {
    stop('已暂停；已跳到选定的预测位置。');
    xControl.value = button.getAttribute('data-reg-position'); render();
  }));
  function advance() {
    if (!result) return;
    xControl.value = String(Math.min(90, Math.round(result.x0 * 10) + 1) / 10);
    render();
    if (result?.x0 >= 9) stop('已到 x₀=9，播放结束；数据与拟合线未变。');
  }
  step.addEventListener('click', () => { if (!result || result.x0 >= 9) return; stop('已暂停；逐步移动预测位置。'); advance(); });
  play.addEventListener('click', () => {
    if (!result || reduced.matches) return;
    if (timer !== null) { stop('已暂停；可从当前位置继续。'); return; }
    if (result.x0 >= 9) { xControl.value = '0'; render(); }
    $('[data-reg-motion]').textContent = '正在移动预测位置；五个观测与拟合线不变。手动调整、复制或离开图面会暂停。';
    timer = setInterval(advance, 350); setPlayLabel();
  });
  $('[data-reg-reset]').addEventListener('click', () => {
    stop(); xControl.value = '4'; yControl.value = '26'; levelControl.value = '0.95'; bandControl.value = 'mean'; render();
    $('[data-reg-motion]').textContent = '已恢复原五个观测、x₀=4 与 95% 区间；播放尚未开始。';
  });
  reduced.addEventListener('change', () => {
    if (reduced.matches) stop('减少动态偏好已启用；播放已暂停，请手动选择位置。');
    setPlayLabel();
  });
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop('页面已离开，播放暂停。'); });
  win.addEventListener('pagehide', () => stop('页面已离开，播放暂停。'));
  if ('IntersectionObserver' in win) new win.IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop('图面已离开视口，播放暂停。'); }).observe($('[data-reg-visuals]'));
  copy.addEventListener('click', async () => {
    if (!code) return;
    stop('复制时已暂停；代码对应当前数据与预测位置。');
    const copiedCode = code, copiedRevision = revision, request = ++copyRequest;
    try {
      await navigator.clipboard.writeText(copiedCode);
      if (request !== copyRequest) return;
      $('[data-reg-copy-status]').textContent = copiedRevision === revision ? '已复制当前五行数据、预测位置和两类区间的完整 R 代码。' : '已复制点击时的设置；当前设置已经改变，请重新复制。';
    } catch {
      if (request === copyRequest && copiedRevision === revision) $('[data-reg-copy-status]').textContent = '自动复制不可用；请选中上方完整代码复制。';
    }
  });
  render(); root.dataset.regressionReady = 'true';
}
