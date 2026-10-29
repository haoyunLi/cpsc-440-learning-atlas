import { quantile } from './math.mjs';

export function boxplotAnalysis(values, convention = 'type7') {
  if (!Array.isArray(values) || values.length < 2 || values.length > 500 || values.some(v => !Number.isFinite(v) || Math.abs(v) > 1e10)) throw Error('请输入 2–500 个有限观测，绝对值不超过 1e10。');
  if (!['type7', 'hinges'].includes(convention)) throw Error('请选择四分位数规则。');
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  const at = position => { const low = sorted[Math.floor(position) - 1], high = sorted[Math.ceil(position) - 1]; return low + (high - low) / 2; };
  const lowerPosition = Math.floor((n + 3) / 2) / 2;
  const quartiles = convention === 'type7' ? [.25, .5, .75].map(p => quantile(sorted, p)) : [at(lowerPosition), at((n + 1) / 2), at(n + 1 - lowerPosition)];
  const [q1, median, q3] = quartiles, iqr = q3 - q1, fences = [q1 - 1.5 * iqr, q3 + 1.5 * iqr];
  const isOutlier = value => value < fences[0] || value > fences[1];
  const inside = sorted.filter(value => !isOutlier(value));
  const whiskers = [inside[0], inside.at(-1)], outliers = sorted.filter(isOutlier);
  // Include both fences and every observation; the histogram keeps its own bins.
  const min = Math.min(sorted[0], fences[0]), max = Math.max(sorted.at(-1), fences[1]);
  const span = max - min, padding = span ? span * .05 : Math.max(Math.abs(min) * .1, min === 0 ? 1 : Number.MIN_VALUE);
  const lo = span ? min : min - padding, hi = span ? max : max + padding, offset = Math.abs(lo) / (hi - lo) >= 1000 ? min : 0;
  const magnitude = Math.max(Math.abs(lo - offset), Math.abs(hi - offset));
  const exponent = magnitude >= 1e5 || magnitude < 1 ? Math.max(-323, Math.floor(Math.log10(magnitude))) : 0;
  const unit = 10 ** exponent, axisPadding = span ? (hi - lo) / unit * .05 : 0;
  return { n, convention, sorted, quartiles, q1, median, q3, iqr, fences, whiskers, outliers,
    points: values.map(value => ({ value, outlier: isOutlier(value) })),
    axis: { start: (lo - offset) / unit - axisPadding, end: (hi - offset) / unit + axisPadding, offset, exponent, unit },
    scaleNote: offset ? `本图横轴实际 Y = ${offset} + 刻度${exponent ? ` × 1e${exponent}` : ''}。` : exponent ? `本图横轴刻度 × 1e${exponent} = 原始 Y。` : '本图横轴直接使用原始测量值。' };
}

export function drawBoxplot(svg, result, tickFormat) {
  const ns = 'http://www.w3.org/2000/svg';
  const add = (tag, attributes, text = '') => { const el = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value); if (text) el.textContent = text; svg.append(el); };
  const { start, end, offset, unit } = result.axis, span = end - start;
  const position = value => 85 + (((value - offset) / unit - start) / span) * 550;
  svg.replaceChildren();
  add('line', { x1: 85, x2: 635, y1: 265, y2: 265, class: 'plot-axis' });
  for (let i = 0; i <= 4; i++) {
    const value = start + span * i / 4, x = 85 + 550 * i / 4;
    add('line', { x1: x, x2: x, y1: 265, y2: 270, class: 'plot-axis' });
    add('text', { x, y: 288, 'text-anchor': 'middle', class: 'plot-muted' }, tickFormat(value, span));
  }
  add('text', { x: 350, y: 316, 'text-anchor': 'middle', class: 'plot-label' }, 'Y（测量值；尺度见图下）');
  add('text', { x: 85, y: 30, class: 'plot-label' }, '箱体、须与围栏');
  result.fences.forEach(value => add('line', { x1: position(value), x2: position(value), y1: 55, y2: 240, stroke: '#9a472e', 'stroke-dasharray': '4 4', 'data-box-mark': 'fence' }));
  add('line', { x1: position(result.whiskers[0]), x2: position(result.whiskers[1]), y1: 115, y2: 115, stroke: '#183a37', 'stroke-width': 2 });
  result.whiskers.forEach(value => add('line', { x1: position(value), x2: position(value), y1: 95, y2: 135, stroke: '#183a37', 'stroke-width': 2, 'data-box-mark': 'whisker' }));
  add('rect', { x: position(result.q1), y: 85, width: position(result.q3) - position(result.q1), height: 60, fill: '#dcebe4', stroke: '#086f68', 'stroke-width': 2, 'data-box-mark': 'box' });
  add('line', { x1: position(result.median), x2: position(result.median), y1: 85, y2: 145, stroke: '#183a37', 'stroke-width': 3, 'data-box-mark': 'median' });
  const seen = new Map();
  result.points.forEach(point => {
    const count = seen.get(point.value) || 0; seen.set(point.value, count + 1);
    add('circle', { cx: position(point.value), cy: 185 + count % 5 * 10, r: point.outlier ? 5 : 4, fill: point.outlier ? 'white' : '#086f68', stroke: point.outlier ? '#9a472e' : '#086f68', 'stroke-width': point.outlier ? 2 : 1, 'data-box-point': point.outlier ? 'candidate' : 'inside' });
  });
}

export function boxplotRCode(values, convention = 'type7') {
  boxplotAnalysis(values, convention);
  return `# Current teaching observations; preserve every value.
y <- c(${values.join(', ')})
# The rule affects the box, fences and candidate flags, not the data.
rule <- "${convention}"
q <- ${convention === 'type7' ? 'unname(quantile(y,c(.25,.5,.75),type=7))' : 'fivenum(y)[2:4]'}
iqr <- q[3]-q[1]
fences <- c(q[1]-1.5*iqr,q[3]+1.5*iqr)
outside <- y < fences[1] | y > fences[2]
whiskers <- range(y[!outside])
print(list(rule=rule,quartiles=q,IQR=iqr,fences=fences,
           whiskers=whiskers,candidates=y[outside]))
# Supply the chosen summaries explicitly; boxplot(y) uses Tukey hinges.
b <- list(stats=matrix(c(whiskers[1],q,whiskers[2]),nrow=5),
          n=length(y),conf=matrix(c(NA_real_,NA_real_),nrow=2),
          out=y[outside],group=rep(1,sum(outside)),names="Current data")
bxp(b,horizontal=TRUE,outline=TRUE,xlab="Response",main=rule)
# Candidate flags do not authorize deleting observations.
if (rule=="hinges") print(boxplot.stats(y,do.conf=FALSE))`;
}
