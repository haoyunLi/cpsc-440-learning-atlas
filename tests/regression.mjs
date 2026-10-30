import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as regressionModule from '../assets/regression.mjs';

const { regressionAnalysis, regressionGeometry, regressionRCode } = regressionModule;
const near = (actual, expected, context = '', tolerance = 1e-9) => {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${context}: finite values required`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${context}: ${actual} versus ${expected}`);
};
const levels = [.9, .95, .99];
function runR(input, maxBuffer = 16e6) {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-regression-'));
  try {
    return execFileSync(process.env.RSCRIPT || 'Rscript', ['--vanilla', '-'], {
      input, encoding: 'utf8', maxBuffer, cwd: directory
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

// lm()/predict() provide an independent reference for every legal slider value.
// The mean variance also comes from the coefficient covariance matrix, rather
// than reproducing the browser's h0 formula as the only reference.
const oracle = `options(warn=2)
for (last_y in seq(8,40,by=.5)) {
  d <- data.frame(x=c(1,3,4,5,7), y=c(6,14,10,14,last_y))
  fit <- lm(y~x,data=d)
  df <- df.residual(fit)
  mse <- deviance(fit)/df
  raw <- c(last_y,coef(fit),deviance(fit),mse,mean(d$x),sum((d$x-mean(d$x))^2),df,
           fitted(fit),residuals(fit),residuals(fit)^2)
  cat("FIT",paste(sprintf("%.17g",raw),collapse="|"),sep="|");cat("\n")
  new <- data.frame(x=seq(0,9,by=.1))
  X0 <- model.matrix(~x,new)
  covariance_variance <- rowSums((X0 %*% vcov(fit))*X0)
  for (level in c(.9,.95,.99)) {
    critical <- qt((1+level)/2,df=df)
    ci <- predict(fit,newdata=new,interval="confidence",level=level)
    pi <- predict(fit,newdata=new,interval="prediction",level=level)
    mean_se <- predict(fit,newdata=new,se.fit=TRUE)$se.fit
    new_se <- (pi[,"upr"]-pi[,"lwr"])/(2*critical)
    rows <- cbind(last_y,level,new$x,ci[,"fit"],covariance_variance/mse,
                  covariance_variance,covariance_variance+mse,mean_se,new_se,
                  critical,ci[,"lwr"],ci[,"upr"],pi[,"lwr"],pi[,"upr"])
    for (i in seq_len(nrow(rows))) {
      cat("PRED",paste(sprintf("%.17g",rows[i,]),collapse="|"),sep="|");cat("\n")
    }
  }
}`;
const oracleLines = runR(oracle).trim().split('\n');
const fitReferences = new Map(), predictionReferences = new Map();
for (const line of oracleLines) {
  const [type, ...fields] = line.split('|'), values = fields.map(Number);
  if (type === 'FIT') fitReferences.set(values[0], values);
  else if (type === 'PRED') predictionReferences.set(`${values[0]}:${values[1]}:${values[2].toFixed(1)}`, values);
  else assert.fail(`Unexpected R reference output: ${line}`);
}
assert.equal(fitReferences.size, 65);
assert.equal(predictionReferences.size, 65 * 3 * 91);
let numericalStates = 0, geometryStates = 0, largestEndpointError = 0;
for (let yi = 16; yi <= 80; yi++) for (const level of levels) {
  const lastY = yi / 2, reference = fitReferences.get(lastY);
  const base = regressionAnalysis({ lastY, level, x0: 4 });
  const baseGeometry = regressionGeometry(base), baselineCurve = base.curve;
  [base.fit.intercept, base.fit.slope, base.fit.sse, base.fit.mse, base.fit.xb, base.fit.sxx, base.df]
    .forEach((value, i) => near(value, reference[i + 1], `fit ${lastY}: field ${i}`));
  assert.deepEqual(base.x, [1, 3, 4, 5, 7]);
  assert.deepEqual(base.y, [6, 14, 10, 14, lastY]);
  assert.equal(base.n, 5); assert.equal(base.df, 3);
  assert.deepEqual(base.rows.map(row => row.id), ['R1', 'R2', 'R3', 'R4', 'R5']);
  base.rows.forEach((row, i) => {
    assert.equal(row.x, base.x[i]); assert.equal(row.y, base.y[i]);
    near(row.fitted, reference[8 + i], `fitted ${lastY}/${i}`);
    near(row.residual, reference[13 + i], `residual ${lastY}/${i}`);
    near(row.squaredResidual, reference[18 + i], `squared residual ${lastY}/${i}`);
  });
  near(base.rows.reduce((sum, row) => sum + row.squaredResidual, 0), base.fit.sse, 'SSE from all five rows');
  near(base.rows.reduce((sum, row) => sum + row.residual, 0), 0, 'Residuals sum to zero');
  assert.equal(base.curve.length, 91);
  for (let xi = 0; xi <= 90; xi++) {
    const x0 = xi / 10, expected = predictionReferences.get(`${lastY}:${level}:${x0.toFixed(1)}`);
    const r = regressionAnalysis({ lastY, level, x0, band: 'mean' });
    [r.estimate, r.h0, r.mean.variance, r.prediction.variance, r.mean.se, r.prediction.se,
      r.critical, r.mean.lower, r.mean.upper, r.prediction.lower, r.prediction.upper]
      .forEach((value, i) => near(value, expected[i + 3], `${lastY}/${level}/${x0}: prediction ${i}`));
    for (let i = 10; i < 14; i++) largestEndpointError = Math.max(largestEndpointError,
      Math.abs([r.mean.lower, r.mean.upper, r.prediction.lower, r.prediction.upper][i - 10] - expected[i]));
    assert.equal(r.baseline, .2);
    near(r.distance, (x0 - 4) ** 2 / 20, 'Distance contribution');
    near(r.h0, r.baseline + r.distance, 'Complete h0');
    near(r.prediction.variance - r.mean.variance, r.fit.mse, 'Add variances, not standard errors');
    near(r.mean.halfWidth, r.critical * r.mean.se);
    near(r.prediction.halfWidth, r.critical * r.prediction.se);
    assert.ok(r.prediction.lower < r.mean.lower && r.mean.upper < r.prediction.upper);
    assert.equal(r.extrapolation, x0 < 1 || x0 > 7);
    assert.deepEqual(r.fit, base.fit, 'Changing prediction position cannot refit the observed data');
    assert.deepEqual(r.curve, baselineCurve, 'Changing prediction position cannot change either ribbon');
    const curvePoint = r.curve[xi];
    near(curvePoint.x, x0); near(curvePoint.estimate, expected[3]);
    [curvePoint.meanLower, curvePoint.meanUpper, curvePoint.predictionLower, curvePoint.predictionUpper]
      .forEach((value, i) => near(value, expected[i + 10], 'Full curve also agrees with R'));
    numericalStates++;

    for (const band of ['mean', 'prediction']) {
      const result = band === 'mean' ? r : regressionAnalysis({ lastY, level, x0, band });
      const g = regressionGeometry(result), { left, right, top, bottom } = g.frame;
      assert.deepEqual(result.fit, r.fit); assert.deepEqual(result.curve, r.curve);
      assert.deepEqual(g.domain, baseGeometry.domain, 'x0 and focused target must share one unchanged axis');
      assert.deepEqual(g.frame, baseGeometry.frame);
      assert.deepEqual(g.domain.x, [0, 9]);
      near(g.x(0), left); near(g.x(9), right);
      near(g.y(g.domain.y[0]), bottom); near(g.y(g.domain.y[1]), top);
      near(g.profileX(g.domain.y[0]), left); near(g.profileX(g.domain.y[1]), right);
      assert.deepEqual(g.points.map(point => point.id), result.rows.map(row => row.id));
      g.points.forEach((point, i) => {
        near(point.x, g.x(result.rows[i].x)); near(point.y, g.y(result.rows[i].y));
        near(point.fittedY, g.y(result.rows[i].fitted));
        assert.ok(point.x - 5 > left && point.x + 5 < right);
        assert.ok(point.y - 5 > top && point.y + 5 < bottom);
      });
      for (const point of result.curve) for (const key of ['estimate', 'meanLower', 'meanUpper', 'predictionLower', 'predictionUpper']) {
        const vertical = g.y(point[key]), horizontal = g.profileX(point[key]);
        assert.ok(Number.isFinite(vertical) && vertical > top && vertical < bottom, 'Full ribbon must not clip');
        assert.ok(Number.isFinite(horizontal) && horizontal > left && horizontal < right, 'Profile shares the same data range');
      }
      for (const type of ['mean', 'prediction']) {
        const interval = result[type];
        near((g.y(interval.lower) - g.y(interval.upper)) / (bottom - top),
          (interval.upper - interval.lower) / (g.domain.y[1] - g.domain.y[0]), 'Vertical interval size reflects data units');
        near((g.profileX(interval.upper) - g.profileX(interval.lower)) / (right - left),
          (interval.upper - interval.lower) / (g.domain.y[1] - g.domain.y[0]), 'Horizontal profile uses that same scale');
      }
      geometryStates++;
    }
  }
}
const original = regressionAnalysis();
near(original.fit.slope, 3); near(original.fit.intercept, 2); near(original.fit.sse, 44);
near(original.mean.lower, 8.54943160529642); near(original.mean.upper, 19.4505683947036);
near(original.prediction.lower, .648888624825859); near(original.prediction.upper, 27.3511113751741);
const edge = regressionAnalysis({ x0: 7 }), future = 35;
assert.ok(future > edge.mean.upper && future < edge.prediction.upper);
const left = regressionAnalysis({ x0: 1 });
near(left.mean.halfWidth, edge.mean.halfWidth); near(left.prediction.halfWidth, edge.prediction.halfWidth);
for (const invalid of [{ lastY: 7.5 }, { lastY: 40.5 }, { lastY: 26.1 }, { lastY: NaN }, { lastY: '26' },
  { x0: -.1 }, { x0: 9.1 }, { x0: 4.05 }, { x0: 1e-12 }, { x0: Number.MIN_VALUE }, { x0: Infinity }, { x0: '4' },
  { level: .8 }, { level: '0.95' }, { level: NaN }, { band: 'both' }]) {
  assert.throws(() => regressionAnalysis(invalid));
  assert.throws(() => regressionRCode(invalid));
}

// Execute the actual exported teaching code, and inspect its current settings
// independently so a runnable but hard-coded default export cannot pass.
const exports = [];
for (const lastY of [8, 26, 40]) for (const level of levels) for (const x0 of [0, 4, 7, 8, 9]) {
  const r = regressionAnalysis({ lastY, level, x0, band: 'prediction' });
  const code = regressionRCode(r);
  assert.equal(code, regressionRCode({ lastY, level, x0, band: 'mean' }), 'Display emphasis is not a different dataset or inference');
  assert.ok(code.split('\n').filter(line => line.trimStart().startsWith('#')).every(line => !/[\u3400-\u9fff]/.test(line)));
  exports.push(`local({\n${code}\nstopifnot(identical(d$id,paste0("R",1:5)),
    identical(d$x,c(1,3,4,5,7)),identical(d$y,c(6,14,10,14,${lastY})),
    x0==${x0},level==${level},error_df==3,
    abs(yhat-${r.estimate})<1e-9,abs(mse-${r.fit.mse})<1e-9,
    max(abs(as.numeric(ci)-c(${[r.estimate, r.mean.lower, r.mean.upper].join(',')})))<1e-9,
    max(abs(as.numeric(pi)-c(${[r.estimate, r.prediction.lower, r.prediction.upper].join(',')})))<1e-9)\n})`);
}
runR(`options(warn=2)\npdf(file=NULL)\n${exports.join('\n')}\ndev.off()`, 4e6);

class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.ownerDocument = globalThis.document; this.attrs = {}; this.children = [];
    this.events = {}; this.dataset = {}; this.classes = new Set(); this.value = ''; this.disabled = false;
    this.classList = { add: name => this.classes.add(name), contains: name => this.classes.has(name),
      toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
    this._text = ''; this._html = ''; this.innerHTMLWrites = 0;
  }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; this.innerHTMLWrites++; parseHTML(this, this._html); }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attrs[name] = String(value); if (name === 'value') this.value = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { (this.events[name] ??= []).push(callback); }
  async dispatch(name) {
    if (name === 'click' && this.disabled) return;
    for (const callback of this.events[name] || []) await callback({ target: this, currentTarget: this });
  }
  focus() { document.activeElement = this; }
  querySelectorAll(selector) { return walk(this).slice(1).filter(node => matchesSelector(node, selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}
function matchesSelector(node, selector) {
  if (selector.startsWith('#')) return node.attrs.id === selector.slice(1);
  const attribute = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  assert.ok(attribute, `The fixture must explicitly support selector ${selector}`);
  return attribute[1] in node.attrs && (attribute[2] === undefined || node.attrs[attribute[1]] === attribute[2]);
}
function parseHTML(parent, html) {
  // Parse the module's trusted static markup into a real tree order. Subsequent
  // SVG appends share that tree, so a selector collision with a drawn path is
  // observable instead of being hidden by a hard-coded selector-to-node map.
  const stack = [parent], voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const token of html.match(/<\/?[A-Za-z][^>]*>|[^<]+/g) || []) {
    if (token.startsWith('</')) {
      const tag = token.slice(2, -1).trim().toLowerCase();
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index > 0) stack.length = index;
    } else if (token.startsWith('<')) {
      const [, tag, attributes] = token.match(/^<([A-Za-z][\w:-]*)([\s\S]*?)\/?\s*>$/);
      const node = new Element(tag.toLowerCase());
      for (const attribute of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        node.setAttribute(attribute[1], attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
      }
      stack.at(-1).append(node);
      if (!voidTags.has(node.tag) && !token.endsWith('/>')) stack.push(node);
    } else stack.at(-1)._text += token;
  }
  for (const select of walk(parent).filter(node => node.tag === 'select')) {
    const options = walk(select).filter(node => node.tag === 'option');
    const selected = options.find(option => 'selected' in option.attrs) || options[0];
    select.value = selected?.attrs.value ?? selected?.textContent ?? '';
  }
}
const saved = Object.fromEntries(['document', 'window', 'navigator', 'setInterval', 'clearInterval']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const documentEvents = {}, windowEvents = {}, timers = new Map(), clipboard = [];
let timerId = 0, observerCallback, observerTarget, renderedPlots = 0;
const motion = { matches: false, addEventListener(name, callback) { this[name] = callback; } };
const walk = node => [node, ...node.children.flatMap(walk)];
const serial = node => ({ tag: node.tag,
  attrs: Object.fromEntries(Object.entries(node.attrs).filter(([key]) => !['data-reg-plot', 'data-reg-zoom'].includes(key))),
  text: node.textContent, children: node.children.map(serial) });
try {
  const doc = { hidden: false, activeElement: null,
    createElementNS: (namespace, name) => new Element(name),
    addEventListener(name, callback) { documentEvents[name] = callback; } };
  const win = { matchMedia: () => motion,
    addEventListener(name, callback) { windowEvents[name] = callback; },
    IntersectionObserver: class {
      constructor(callback) { observerCallback = callback; }
      observe(target) { observerTarget = target; }
    } };
  doc.defaultView = win;
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: {
    clipboard: { writeText: async text => { clipboard.push(text); } }
  }, configurable: true });
  globalThis.setInterval = (callback, delay) => {
    assert.equal(delay, 350, 'The scan advances by a deliberate readable step');
    timers.set(++timerId, callback); return timerId;
  };
  globalThis.clearInterval = id => timers.delete(id);
  const { drawRegression, mountRegression } = regressionModule;
  assert.equal(typeof drawRegression, 'function'); assert.equal(typeof mountRegression, 'function');
  const svg = new Element('svg');
  // Inspect the production SVG, not only its numerical geometry helpers.
  for (const lastY of [8, 26, 40]) for (const level of levels) for (const x0 of [0, 4, 7, 8, 9]) for (const band of ['mean', 'prediction']) {
    const result = regressionAnalysis({ lastY, level, x0, band }), g = regressionGeometry(result);
    for (const type of ['main', 'profile']) {
      drawRegression(svg, result, type);
      const nodes = walk(svg);
      assert.ok(nodes.every(node => Object.values(node.attrs).every(value => !/NaN|Infinity/.test(value))));
      near(Number(svg.attrs['data-reg-y-min']), g.domain.y[0]);
      near(Number(svg.attrs['data-reg-y-max']), g.domain.y[1]);
      assert.match(svg.attrs['aria-label'], /mean CI.*individual PI/);
      assert.equal(svg.attrs['aria-label'].includes('外推'), result.extrapolation);
      if (type === 'main') {
        const points = nodes.filter(node => 'data-reg-point' in node.attrs);
        assert.deepEqual(points.map(point => point.attrs['data-reg-point']), ['R1', 'R2', 'R3', 'R4', 'R5']);
        points.forEach((point, i) => {
          near(Number(point.attrs.cx), g.points[i].x); near(Number(point.attrs.cy), g.points[i].y);
          assert.match(point.children[0].textContent, new RegExp(`R${i + 1}：x=`));
        });
        const residuals = nodes.filter(node => 'data-reg-residual' in node.attrs);
        residuals.forEach((line, i) => {
          near(Number(line.attrs.x1), g.points[i].x); near(Number(line.attrs.x2), g.points[i].x);
          near(Number(line.attrs.y1), g.points[i].y); near(Number(line.attrs.y2), g.points[i].fittedY);
        });
        assert.equal(residuals.length, 5);
        assert.deepEqual(nodes.filter(node => 'data-reg-ribbon' in node.attrs).map(node => node.attrs['data-reg-ribbon']), ['prediction', 'mean']);
        const reference = nodes.find(node => node.attrs['data-reg-line'] === 'x0');
        near(Number(reference.attrs.x1), g.x(x0)); near(Number(reference.attrs.x2), g.x(x0));
        const center = nodes.find(node => node.attrs['data-reg-predicted'] === 'true');
        assert.ok(center.attrs.d.startsWith(`M${g.x(x0)},${g.y(result.estimate) - 7}`));
        for (const kind of ['mean', 'prediction']) {
          const interval = result[kind], slice = nodes.find(node => node.attrs['data-reg-slice'] === kind);
          near(Number(slice.attrs.x1), g.x(x0)); near(Number(slice.attrs.x2), g.x(x0));
          near(Number(slice.attrs.y1), g.y(interval.lower)); near(Number(slice.attrs.y2), g.y(interval.upper));
          assert.equal(slice.attrs['stroke-dasharray'] === 'none', kind === 'mean');
          for (const end of ['lower', 'upper']) {
            const cap = nodes.find(node => node.attrs['data-reg-cap'] === `${kind}:${end}`);
            near(Number(cap.attrs.y1), g.y(interval[end])); near(Number(cap.attrs.y2), g.y(interval[end]));
            near((Number(cap.attrs.x1) + Number(cap.attrs.x2)) / 2, g.x(x0));
          }
        }
      } else {
        assert.equal(nodes.filter(node => 'data-reg-profile' in node.attrs).length, 2);
        for (const kind of ['mean', 'prediction']) {
          const interval = result[kind], line = nodes.find(node => node.attrs['data-reg-profile'] === kind);
          near(Number(line.attrs.x1), g.profileX(interval.lower)); near(Number(line.attrs.x2), g.profileX(interval.upper));
          near(Number(line.attrs.y1), g.profileFrame.rows[kind]); near(Number(line.attrs.y2), g.profileFrame.rows[kind]);
          assert.equal(line.attrs['stroke-dasharray'] === 'none', kind === 'mean');
          for (const end of ['lower', 'upper']) {
            const cap = nodes.find(node => node.attrs['data-reg-endpoint'] === `${kind}:${end}`);
            near(Number(cap.attrs.x1), g.profileX(interval[end])); near(Number(cap.attrs.x2), g.profileX(interval[end]));
            near((Number(cap.attrs.y1) + Number(cap.attrs.y2)) / 2, g.profileFrame.rows[kind]);
          }
          const center = nodes.find(node => node.attrs['data-reg-center'] === kind);
          assert.ok(center.attrs.d.startsWith(`M${g.profileX(result.estimate)},${g.profileFrame.rows[kind] - 7}`));
        }
      }
      renderedPlots++;
    }
  }
  assert.throws(() => drawRegression(svg, original, 'invalid'));

  const root = new Element();
  mountRegression(root); mountRegression(root);
  const nodes = {}, positions = root.querySelectorAll('[data-reg-position]');
  for (const id of ['rx', 'ry', 'band', 'rx-v', 'ry-v']) nodes[`#${id}`] = root.querySelector(`#${id}`);
  for (const name of ['level', 'play', 'step', 'reset', 'motion', 'error', 'result', 'visuals', 'calculation', 'boundary-note', 'sse', 'copy', 'code', 'copy-status']) {
    nodes[`[data-reg-${name}]`] = root.querySelector(`[data-reg-${name}]`);
  }
  for (const type of ['main', 'profile']) for (const key of ['plot', 'zoom']) nodes[`[data-reg-${key}="${type}"]`] = root.querySelector(`[data-reg-${key}="${type}"]`);
  for (let i = 1; i <= 5; i++) {
    nodes[`[data-reg-row="R${i}"]`] = root.querySelector(`[data-reg-row="R${i}"]`);
    for (const key of ['x', 'y', 'fitted', 'residual', 'squaredResidual']) nodes[`[data-reg-cell="R${i}:${key}"]`] = root.querySelector(`[data-reg-cell="R${i}:${key}"]`);
  }
  const get = key => nodes[`[data-reg-${key}]`], plot = type => nodes[`[data-reg-plot="${type}"]`];
  for (const [selector, node] of Object.entries(nodes)) {
    assert.ok(node, `Rendered markup must provide ${selector}`);
    assert.equal(root.querySelectorAll(selector).length, 1, `${selector} must resolve unambiguously`);
  }
  assert.equal(root.querySelector('[data-reg-boundary]').tag, 'path', 'The fixture exposes the original SVG/paragraph selector collision');
  assert.equal(root.querySelectorAll('[data-reg-boundary]').length, 8);
  assert.equal(get('boundary-note').tag, 'p');
  assert.equal(nodes['#rx'].events.input.length, 1);
  assert.equal(get('play').events.click.length, 1);
  assert.equal(positions[0].events.click.length, 1);
  assert.equal(root.innerHTMLWrites, 1, 'Mounting twice must not rebuild controls');
  assert.equal(observerTarget, get('visuals'), 'Pause when the actual graph group leaves the viewport');
  const markup = root.innerHTML, originalNodes = { ...nodes };
  assert.match(markup, /id="rx-v"[^>]*aria-live="off"/);
  assert.match(markup, /训练|已用于拟合/);
  assert.match(markup, /不会变成整条曲线的同时置信带/);
  const current = () => regressionAnalysis({ lastY: Number(nodes['#ry'].value), x0: Number(nodes['#rx'].value), level: Number(get('level').value), band: nodes['#band'].value });
  const check = () => {
    const result = current(), g = regressionGeometry(result);
    assert.equal(get('error').textContent, '');
    assert.equal(get('code').textContent, regressionRCode(result));
    assert.equal(get('copy').disabled, false);
    near(Number(nodes['#rx-v'].textContent), result.x0); near(Number(nodes['#ry-v'].textContent), result.lastY);
    for (const type of ['main', 'profile']) {
      assert.deepEqual(serial(plot(type)), serial(nodes[`[data-reg-zoom="${type}"]`]), 'Zoom preserves the current graph exactly');
      near(Number(plot(type).attrs['data-reg-y-min']), g.domain.y[0]);
      near(Number(plot(type).attrs['data-reg-y-max']), g.domain.y[1]);
    }
    for (const row of result.rows) for (const key of ['x', 'y', 'fitted', 'residual', 'squaredResidual']) {
      near(Number(nodes[`[data-reg-cell="${row.id}:${key}"]`].textContent), row[key], `Visible ${row.id}:${key}`, 5e-5);
    }
    assert.equal(root.querySelectorAll('[data-reg-boundary-note]').length, 1);
    assert.equal(root.querySelector('[data-reg-boundary-note]'), get('boundary-note'));
    assert.match(get('boundary-note').textContent, /^当前 x₀=/);
    assert.equal(get('boundary-note').textContent.includes('extrapolation'), result.extrapolation);
    assert.ok(walk(plot('main')).filter(node => 'data-reg-boundary' in node.attrs).every(node => node.textContent === ''), 'Reading explanations belong in the visible paragraph, not SVG paths');
    assert.match(get('calculation').innerHTML, /df=5−2=3/);
    assert.match(get('calculation').innerHTML, /先加 variance，再开平方/);
    return result;
  };
  const stopped = () => { assert.equal(timers.size, 0); assert.equal(get('play').attrs['aria-pressed'], 'false'); };
  const tick = () => [...timers.values()].forEach(callback => callback());
  const initial = check(); stopped();
  const originalAxis = [plot('main').attrs['data-reg-y-min'], plot('main').attrs['data-reg-y-max']];
  for (const button of positions) {
    button.focus(); await button.dispatch('click');
    assert.equal(document.activeElement, button); assert.equal(button.attrs['aria-pressed'], 'true');
    const result = check();
    assert.equal(result.x0, Number(button.getAttribute('data-reg-position')));
    assert.deepEqual(result.fit, initial.fit);
    assert.deepEqual([plot('main').attrs['data-reg-y-min'], plot('main').attrs['data-reg-y-max']], originalAxis);
    stopped();
  }
  nodes['#band'].focus(); nodes['#band'].value = 'prediction'; await nodes['#band'].dispatch('change');
  assert.equal(document.activeElement, nodes['#band']); check();
  assert.deepEqual([plot('main').attrs['data-reg-y-min'], plot('main').attrs['data-reg-y-max']], originalAxis);
  nodes['#ry'].value = '40'; await nodes['#ry'].dispatch('input');
  assert.notDeepEqual(check().fit, initial.fit, 'Changing an observed response refits both line and error variance');
  get('level').value = '0.99'; await get('level').dispatch('input'); check();
  await get('reset').dispatch('click'); assert.deepEqual(check(), original); stopped();

  // One sweep changes only prediction position. No repeated status announcement
  // accompanies each frame; the start and terminal messages carry the lifecycle.
  get('play').focus(); await get('play').dispatch('click');
  assert.equal(timers.size, 1); assert.equal(get('play').attrs['aria-pressed'], 'true');
  const playingMessage = get('motion').textContent;
  for (let i = 41; i <= 90; i++) {
    tick(); const r = check(); near(r.x0, i / 10); assert.deepEqual(r.fit, original.fit);
    assert.equal(document.activeElement, get('play'));
    if (i < 90) assert.equal(get('motion').textContent, playingMessage);
  }
  stopped(); assert.match(get('motion').textContent, /已到.*9/); assert.equal(get('step').disabled, true);
  await get('play').dispatch('click'); assert.equal(nodes['#rx'].value, '0'); assert.equal(timers.size, 1);
  tick(); near(check().x0, .1); await get('play').dispatch('click'); stopped();
  await get('step').dispatch('click'); near(check().x0, .2); stopped();
  for (const control of [nodes['#rx'], nodes['#ry'], get('level'), nodes['#band']]) {
    await get('play').dispatch('click'); assert.equal(timers.size, 1);
    control.focus(); await control.dispatch('input'); stopped(); assert.equal(document.activeElement, control); check();
  }
  await get('play').dispatch('click'); await positions[1].dispatch('click'); stopped(); near(check().x0, 7);
  await get('play').dispatch('click'); await get('reset').dispatch('click'); stopped(); check();
  await get('play').dispatch('click'); motion.matches = true; motion.change(); stopped();
  assert.equal(get('play').disabled, true); await get('play').dispatch('click'); stopped();
  await get('step').dispatch('click'); near(check().x0, 4.1);
  motion.matches = false; motion.change(); assert.equal(get('play').disabled, false);
  await get('play').dispatch('click'); doc.hidden = true; documentEvents.visibilitychange(); stopped(); doc.hidden = false;
  await get('play').dispatch('click'); observerCallback([{ isIntersecting: false }]); stopped();
  await get('play').dispatch('click'); windowEvents.pagehide(); stopped();

  for (const [control, bad] of [[nodes['#rx'], ''], [nodes['#ry'], 'NaN'], [get('level'), '.8'], [nodes['#band'], 'unknown']]) {
    await get('reset').dispatch('click'); await get('play').dispatch('click');
    control.value = bad; await control.dispatch('input'); stopped();
    assert.ok(get('error').textContent); assert.equal(get('code').textContent, '');
    assert.equal(get('result').textContent, ''); assert.equal(get('copy').disabled, true);
    assert.equal(get('boundary-note').textContent, '');
    assert.equal(get('play').disabled, true); assert.equal(get('step').disabled, true);
    assert.equal(plot('main').children.length, 0); assert.equal(plot('profile').children.length, 0);
    assert.equal(nodes['[data-reg-cell="R5:y"]'].textContent, '—');
    const count = clipboard.length; await get('copy').dispatch('click'); assert.equal(clipboard.length, count);
  }
  await get('reset').dispatch('click'); check();
  await get('play').dispatch('click'); tick(); const copiedState = current();
  await get('copy').dispatch('click'); stopped();
  assert.equal(clipboard.at(-1), regressionRCode(copiedState)); assert.match(get('copy-status').textContent, /已复制当前/);
  await positions[1].dispatch('click'); assert.equal(get('copy-status').textContent, '');
  const pendingCopies = [];
  navigator.clipboard.writeText = text => { clipboard.push(text); return new Promise(resolve => pendingCopies.push(resolve)); };
  const pending = get('copy').dispatch('click'); await positions[2].dispatch('click');
  pendingCopies.shift()(); await pending;
  assert.match(get('copy-status').textContent, /点击时的设置.*重新复制/);
  const older = get('copy').dispatch('click'); await positions[0].dispatch('click');
  const newer = get('copy').dispatch('click');
  pendingCopies[1](); await newer;
  const currentMessage = get('copy-status').textContent;
  pendingCopies[0](); await older;
  assert.equal(get('copy-status').textContent, currentMessage, 'Older clipboard completion cannot overwrite the current success');
  assert.match(currentMessage, /已复制当前/);
  navigator.clipboard.writeText = async () => { throw Error('denied'); };
  await get('copy').dispatch('click'); assert.match(get('copy-status').textContent, /选中上方完整代码复制/);
  assert.equal(root.innerHTML, markup); assert.equal(root.innerHTMLWrites, 1);
  for (const [selector, node] of Object.entries(originalNodes)) assert.equal(root.querySelector(selector), node);
} finally {
  for (const [key, descriptor] of Object.entries(saved)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
}

console.log(`Regression: ${numericalStates} independent R predictions, 65 complete five-row fits, ${geometryStates} same-axis geometry states, ${exports.length} executable current-state R exports (max endpoint error ${largestEndpointError.toExponential(2)}) passed.`);
console.log(`${renderedPlots} rendered main/profile SVG states, stable controls/rows/focus, presets/reset, sweep completion/pause, reduced motion, graph visibility, pagehide and clipboard revision/error lifecycles passed.`);
