import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseMethod, mountWorkbench } from '../assets/workbench.mjs';

// Validate lesson destinations from content sources, independently of a build.
const anchors = new Map();
for (const part of [1, 2, 3]) {
  for (const chapter of JSON.parse(readFileSync(new URL(`../content/part${part}.json`, import.meta.url), 'utf8'))) {
    anchors.set(chapter.id, new Set((chapter.sections || chapter.lessons).map(section => section.id)));
  }
}
for (const lesson of JSON.parse(readFileSync(new URL('../content/deepening.json', import.meta.url), 'utf8'))) anchors.get(lesson.chapter).add(lesson.id);
function validDestination(result) {
  assert.ok(anchors.get(result.chapter)?.has(result.anchor), `${result.chapter}.html#${result.anchor}`);
  for (const key of ['title', 'why', 'caution']) assert.ok(typeof result[key] === 'string' && result[key].length > 0);
}
const goals = ['mean', 'variance', 'relationship', 'compare', 'describe'];
const designs = ['independent', 'paired', 'blocked'];
let count = 0;
for (const goal of goals) for (const design of designs) for (const groups of ['one', 'two', 'many']) for (const factors of ['one', 'two']) for (const equal of ['unsure', 'yes']) {
  const state = { goal, design, groups, factors, equal }, result = chooseMethod(state);
  validDestination(result); count++;
  if (goal === 'variance' && design === 'paired') {
    assert.match(result.title, /相关观测/);
    assert.match(result.caution, /Brown–Forsythe 都不能直接套用/);
  }
  if (goal === 'relationship' && design === 'paired') {
    assert.match(result.title, /重复单位/);
    assert.match(result.why, /每个独立单位只记录一对 \(X,Y\)/);
    assert.match(result.caution, /不能.*普通独立误差 SLR/);
  }
  if (['variance', 'relationship', 'compare'].includes(goal) && design === 'blocked') assert.equal(result.chapter, '15');
  if (goal === 'compare') {
    assert.match(result.caution, /不需要先拒绝 omnibus|不要求先拒绝 omnibus/);
    if (design === 'independent' && factors === 'one') {
      if (equal === 'yes') { assert.equal(result.anchor, 'procedures'); assert.match(result.caution, /独立、正态、共同 residual variance/); }
      else { assert.equal(result.anchor, 'welch-anova-complete'); assert.match(result.title, /Welch/); assert.match(result.caution, /不要直接接共同 MSE 的经典 Tukey/); }
    }
    if (design === 'blocked') assert.match(result.why, /cᵀCov\(β̂\)c/);
    if (design === 'paired') assert.match(result.caution, /不要求两列边际 variance 相等/);
  }
}
assert.equal(count, 180);

// Real chooser mount/update path; the small fixture checks controls and links,
// while native select interaction and responsive presentation need a browser.
function fixture(state = {}) {
  const controls = Object.fromEntries(Object.entries({ goal: 'mean', design: 'independent', groups: 'two', factors: 'one', equal: 'unsure', ...state }).map(([key, value]) => {
    const label = { inactive: false, classList: { toggle(name, active) { label.inactive = active; } } };
    return [key, { value, disabled: false, label, events: {}, closest() { return label; }, addEventListener(name, callback) { this.events[name] = callback; } }];
  }));
  const result = { innerHTML: '' };
  const root = {
    dataset: { workbench: 'chooser' }, classList: { add() {} },
    querySelector(selector) { return selector === '.wbench-result' ? result : controls[selector.match(/data-field="(.+)"/)[1]]; },
    querySelectorAll() { return Object.values(controls); }
  };
  mountWorkbench(root);
  return { root, controls, result, update(key, value) { controls[key].value = value; controls[key].events.input(); } };
}
for (const goal of goals) for (const design of designs) for (const groups of ['one', 'two', 'many']) for (const factors of ['one', 'two']) for (const equal of ['unsure', 'yes']) {
  const state = { goal, design, groups, factors, equal }, rendered = fixture(state), expected = chooseMethod(state);
  const url = new URL(rendered.result.innerHTML.match(/href="([^"]+)"/)[1]);
  assert.ok(url.pathname.endsWith(`/chapters/${expected.chapter}.html`));
  assert.equal(url.hash, `#${expected.anchor}`);
  assert.equal(rendered.controls.design.disabled, goal === 'describe');
  for (const control of Object.values(rendered.controls)) assert.equal(control.label.inactive, control.disabled);
}
const ui = fixture({ design: 'paired', groups: 'many' });
assert.match(ui.result.innerHTML, /相关观测/);
ui.update('goal', 'relationship');
assert.equal(ui.controls.design.disabled, false);
assert.match(ui.result.innerHTML, /重复单位/);
ui.update('design', 'independent');
assert.match(ui.result.innerHTML, /独立单位的连续关系/);
ui.update('design', 'paired'); ui.update('goal', 'variance');
assert.equal(ui.controls.design.disabled, false);
assert.match(ui.result.innerHTML, /Brown–Forsythe 都不能直接套用/);
ui.update('design', 'blocked'); assert.match(ui.result.innerHTML, /背景与误差变异/);

ui.update('goal', 'mean'); ui.update('design', 'independent');
assert.match(ui.result.innerHTML, /Welch one-way ANOVA/);
ui.update('goal', 'compare');
assert.equal(ui.controls.equal.disabled, false);
assert.equal(ui.controls.design.disabled, false);
assert.equal(ui.controls.equal.value, 'unsure');
assert.match(ui.result.innerHTML, /Welch 单项检验/);
assert.match(ui.result.innerHTML, /08.html#welch-anova-complete/);
ui.update('equal', 'yes');
assert.match(ui.result.innerHTML, /独立同方差组/);
assert.match(ui.result.innerHTML, /09.html#procedures/);
ui.update('design', 'paired');
// Paired-difference inference does not depend on equal marginal variances.
assert.equal(ui.controls.equal.disabled, true);
assert.match(ui.result.innerHTML, /不要求两列边际 variance 相等/);
ui.update('factors', 'two'); assert.match(ui.result.innerHTML, /重复观测 factorial/);
ui.update('design', 'blocked'); assert.match(ui.result.innerHTML, /15.html#factorial-rcbd-worked/);
assert.equal(ui.controls.equal.disabled, false);
ui.update('equal', 'unsure'); assert.match(ui.result.innerHTML, /还需匹配的异方差模型/);
ui.update('factors', 'one'); assert.match(ui.result.innerHTML, /15.html#missing-block-cell-worked/);
ui.update('goal', 'variance'); ui.update('design', 'independent'); ui.update('factors', 'two');
assert.match(ui.result.innerHTML, /14.html#factorial-bf-cells/);
ui.update('goal', 'mean'); assert.equal(ui.controls.groups.disabled, true);
ui.update('goal', 'describe'); assert.ok(['design', 'groups', 'factors', 'equal'].every(key => ui.controls[key].disabled));
assert.doesNotMatch(ui.root.innerHTML, /ANOVA 之后的具体比较/);
assert.match(ui.root.innerHTML, /具体均值比较与多重校正/);

const handbook = readFileSync(new URL('../content/handbook.html', import.meta.url), 'utf8');
const methodMap = handbook.match(/<section id="method-map"[\s\S]*?<\/section>/)[0];
assert.match(methodMap, /独立、正态、共同 residual variance/);
assert.match(methodMap, /不要求先拒绝 omnibus/);
assert.match(methodMap, /SE=√\[cᵀCov\(β̂\)c\]/);
assert.match(methodMap, /每单位记录一对 \(X,Y\) 本身不意味着误差相关/);
assert.match(methodMap, /独立组 Brown–Forsythe 都不能直接分析相关原始行/);
for (const match of methodMap.matchAll(/href="chapters\/(\d+)\.html#([^"]+)"/g)) assert.ok(anchors.get(match[1])?.has(match[2]), match[0]);
console.log('All 180 chooser combinations, exact lesson links, design/variance transitions and handbook model boundaries passed.');
