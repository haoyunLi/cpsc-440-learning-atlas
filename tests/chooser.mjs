import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chooseMethod, mountWorkbench } from '../assets/workbench.mjs';

// Validate lesson destinations from content sources, independently of a build.
const anchors = new Map();
function addLesson(chapter, lesson) {
  const ids = anchors.get(chapter) || new Set();
  ids.add(lesson.id);
  for (const match of (lesson.body || '').matchAll(/\bid\s*=\s*(["'])(.*?)\1/g)) ids.add(match[2]);
  anchors.set(chapter, ids);
}
for (const part of [1, 2, 3]) {
  for (const chapter of JSON.parse(readFileSync(new URL(`../content/part${part}.json`, import.meta.url), 'utf8'))) {
    for (const lesson of chapter.sections || chapter.lessons) addLesson(chapter.id, lesson);
  }
}
for (const lesson of JSON.parse(readFileSync(new URL('../content/deepening.json', import.meta.url), 'utf8'))) addLesson(lesson.chapter, lesson);
function validDestination(result) {
  assert.ok(anchors.get(result.chapter)?.has(result.anchor), `${result.chapter}.html#${result.anchor}`);
  for (const key of ['title', 'why', 'caution']) assert.ok(typeof result[key] === 'string' && result[key].length > 0);
}
const goals = ['mean', 'variance', 'relationship', 'compare', 'describe'];
const designs = ['independent', 'paired', 'blocked'];
const locationTargets = ['median', 'symmetric', 'distribution'];
let count = 0;
for (const goal of goals) for (const design of designs) for (const groups of ['one', 'two', 'many']) for (const factors of ['one', 'two']) for (const equal of ['unsure', 'yes']) {
  const state = { goal, design, groups, factors, equal }, result = chooseMethod(state);
  validDestination(result); count++;
  // Hidden target selections must never change any of the original five goals.
  for (const locationTarget of [...locationTargets, 'invalid-saved-value']) assert.deepEqual(chooseMethod({ ...state, locationTarget }), result);
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

let locationCount = 0, validLocationCount = 0;
for (const locationTarget of locationTargets) for (const design of designs) for (const groups of ['one', 'two', 'many']) for (const factors of ['one', 'two']) for (const equal of ['unsure', 'yes']) {
  const state = { goal: 'location', locationTarget, design, groups, factors, equal };
  const result = chooseMethod(state);
  validDestination(result); locationCount++;
  // Variance answers retained from another goal have no role in this routing.
  assert.deepEqual(chooseMethod({ ...state, equal: equal === 'yes' ? 'unsure' : 'yes' }), result);
  const valid = factors === 'one' && ((locationTarget !== 'distribution' && (design === 'independent' && groups === 'one' || design === 'paired' && groups === 'two')) || locationTarget === 'distribution' && design === 'independent' && groups !== 'one');
  assert.equal(result.boundary === true, !valid, JSON.stringify(state));
  if (valid) validLocationCount++;
  if (factors === 'two') {
    assert.equal(result.chapter, design === 'blocked' ? '15' : '14');
    assert.equal(result.anchor, design === 'blocked' ? 'factorial-blocks' : 'interaction');
    assert.match(result.caution, /不是.*现成检验/);
  } else if (design === 'blocked') {
    assert.equal(result.chapter, '15'); assert.equal(result.anchor, 'blocking');
    assert.match(result.caution, /不会自动调整 blocks/);
  } else if (design === 'paired' && groups !== 'two') {
    assert.equal(result.chapter, '06'); assert.equal(result.anchor, 'paired-t');
    assert.match(result.caution, /不表示此时应采用 paired t/);
  } else if (locationTarget === 'median') {
    if (valid) {
      assert.equal(result.chapter, '05'); assert.equal(result.anchor, 'median');
      assert.match(result.caution, /Binomial\(m,.5\)/);
      assert.match(result.caution, /零差.*ties/);
      assert.match(result.caution, /不要求.*对称/);
      if (design === 'paired') assert.match(result.why, /median\(A−B\) 一般不等于两个边际 medians 的差/);
    } else {
      assert.equal(result.anchor, groups === 'two' ? 'rank-sum' : 'kruskal');
      assert.match(result.caution, /并未解决任意不同形状总体的 median 比较/);
    }
  } else if (locationTarget === 'symmetric') {
    if (valid) {
      assert.equal(result.chapter, '06'); assert.equal(result.anchor, 'signed-rank');
      assert.match(result.why, design === 'paired' ? /真实 pairs|设计中的真实 pairs/ : /D=Y−M₀/);
      assert.match(result.caution, /对称性.*符号与绝对大小/);
      assert.match(result.caution, /零差.*ties.*exact.*近似/);
    } else {
      assert.equal(result.anchor, groups === 'two' ? 'rank-sum' : 'kruskal');
      assert.match(result.why, /各组分别对称.*不保证.*共同形状.*不会生成 pairs/);
    }
  } else if (valid) {
    assert.equal(result.anchor, groups === 'two' ? 'rank-sum' : 'kruskal');
    assert.match(result.why, /基本 null 是各组同分布.*独立观测.*可交换性/);
    assert.match(result.caution, /不是所有分布差异的通用检测.*不是 mean test/);
    assert.match(result.caution, /共同形状.*location-shift/);
    assert.match(result.caution, /Ties.*exact \/ permutation.*近似/);
    if (groups === 'many') assert.match(result.caution, /整体拒绝不能确定哪一对不同，也不指定某组更大/);
  } else if (design === 'paired') {
    assert.equal(result.anchor, 'signed-rank');
    assert.match(result.why, /不能套用独立组 rank-sum/);
    assert.match(result.caution, /不是任意两种相关分布相同的通用检验/);
  } else {
    assert.equal(result.anchor, 'median'); assert.equal(groups, 'one');
    assert.match(result.caution, /不是一般的分布拟合优度检验/);
  }
}
assert.equal(locationCount, 108);
assert.equal(validLocationCount, 12);
assert.deepEqual(chooseMethod({ goal: 'location' }), chooseMethod({ goal: 'location', locationTarget: 'median' }));
assert.equal(chooseMethod({ goal: 'location', locationTarget: 'unknown', groups: 'one' }).boundary, true);

// Real chooser mount/update path; the small fixture checks controls and links,
// while native select interaction and responsive presentation need a browser.
function fixture(state = {}) {
  const controls = Object.fromEntries(Object.entries({ goal: 'mean', design: 'independent', groups: 'two', factors: 'one', equal: 'unsure', locationTarget: 'median', ...state }).map(([key, value]) => {
    const label = { inactive: false, hidden: false, classList: { toggle(name, active) { label.inactive = active; } } };
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
  assert.equal(rendered.controls.locationTarget.disabled, true);
  assert.equal(rendered.controls.locationTarget.label.hidden, true);
  for (const control of Object.values(rendered.controls)) assert.equal(control.label.inactive, control.disabled);
}
for (const locationTarget of locationTargets) for (const design of designs) for (const groups of ['one', 'two', 'many']) for (const factors of ['one', 'two']) for (const equal of ['unsure', 'yes']) {
  const state = { goal: 'location', locationTarget, design, groups, factors, equal };
  const rendered = fixture(state), expected = chooseMethod(state);
  const url = new URL(rendered.result.innerHTML.match(/href="([^"]+)"/)[1]);
  assert.ok(url.pathname.endsWith(`/chapters/${expected.chapter}.html`));
  assert.equal(url.hash, `#${expected.anchor}`);
  for (const key of ['design', 'groups', 'factors', 'locationTarget']) assert.equal(rendered.controls[key].disabled, false);
  assert.equal(rendered.controls.locationTarget.label.hidden, false);
  assert.equal(rendered.controls.equal.disabled, true);
  assert.equal(rendered.result.innerHTML.includes('需要先补充模型或调整问题'), expected.boundary === true);
  assert.equal(rendered.result.innerHTML.includes('查看适用边界与基础'), expected.boundary === true);
  assert.match(rendered.result.innerHTML, /20 个 pairs 仍是两个条件/);
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

// Walk through the real input callbacks: previously inactive group settings
// become visible constraints, while saved variance/target values never leak.
const locationUI = fixture({ factors: 'two', groups: 'many', equal: 'yes' });
const originalControls = { ...locationUI.controls }, originalMarkup = locationUI.root.innerHTML;
assert.equal(locationUI.controls.groups.disabled, true);
locationUI.update('goal', 'location');
assert.equal(locationUI.controls.groups.disabled, false);
assert.equal(locationUI.controls.locationTarget.label.hidden, false);
assert.match(locationUI.result.innerHTML, /14.html#interaction/);
assert.match(locationUI.result.innerHTML, /需要先补充模型或调整问题/);
locationUI.update('factors', 'one');
assert.match(locationUI.result.innerHTML, /08.html#kruskal/);
assert.match(locationUI.result.innerHTML, /并未解决任意不同形状总体的 median 比较/);
locationUI.update('design', 'paired');
assert.match(locationUI.result.innerHTML, /06.html#paired-t/);
assert.match(locationUI.result.innerHTML, /不表示此时应采用 paired t/);
locationUI.update('groups', 'two');
assert.match(locationUI.result.innerHTML, /05.html#median/);
assert.doesNotMatch(locationUI.result.innerHTML, /需要先补充模型或调整问题/);
assert.match(locationUI.result.innerHTML, /median\(A−B\) 一般不等于两个边际 medians 的差/);
locationUI.update('locationTarget', 'symmetric');
assert.match(locationUI.result.innerHTML, /06.html#signed-rank/);
assert.doesNotMatch(locationUI.result.innerHTML, /需要先补充模型或调整问题/);
locationUI.update('locationTarget', 'distribution');
assert.match(locationUI.result.innerHTML, /需要先补充模型或调整问题/);
assert.match(locationUI.result.innerHTML, /不能套用独立组 rank-sum/);
locationUI.update('design', 'independent');
assert.match(locationUI.result.innerHTML, /06.html#rank-sum/);
assert.doesNotMatch(locationUI.result.innerHTML, /需要先补充模型或调整问题/);
locationUI.update('groups', 'many');
assert.match(locationUI.result.innerHTML, /08.html#kruskal/);
assert.match(locationUI.result.innerHTML, /整体拒绝不能确定哪一对/);
const ranksWithSavedEqual = locationUI.result.innerHTML;
locationUI.update('equal', 'unsure');
assert.equal(locationUI.result.innerHTML, ranksWithSavedEqual);
assert.equal(locationUI.controls.equal.disabled, true);
locationUI.update('groups', 'one');
assert.match(locationUI.result.innerHTML, /尚未指定比较对象/);
assert.match(locationUI.result.innerHTML, /查看适用边界与基础/);
locationUI.update('locationTarget', 'median');
assert.match(locationUI.result.innerHTML, /单总体 median：Sign test/);
locationUI.update('locationTarget', 'symmetric');
assert.match(locationUI.result.innerHTML, /D=Y−M₀/);
locationUI.update('goal', 'mean');
assert.equal(locationUI.controls.locationTarget.disabled, true);
assert.equal(locationUI.controls.locationTarget.label.hidden, true);
assert.match(locationUI.result.innerHTML, /05.html#student/);
assert.doesNotMatch(locationUI.result.innerHTML, /signed-rank|需要先补充模型或调整问题/);
const meanBeforeHiddenChange = locationUI.result.innerHTML;
locationUI.update('locationTarget', 'distribution');
assert.equal(locationUI.result.innerHTML, meanBeforeHiddenChange);
locationUI.update('groups', 'many'); locationUI.update('equal', 'yes');
assert.match(locationUI.result.innerHTML, /08.html#model/);
locationUI.update('goal', 'location');
assert.equal(locationUI.controls.locationTarget.value, 'distribution');
assert.equal(locationUI.controls.equal.value, 'yes');
assert.equal(locationUI.controls.equal.disabled, true);
assert.match(locationUI.result.innerHTML, /08.html#kruskal/);
locationUI.update('goal', 'compare');
assert.equal(locationUI.controls.equal.disabled, false);
assert.match(locationUI.result.innerHTML, /09.html#procedures/);
locationUI.update('goal', 'describe');
assert.ok(['design', 'groups', 'factors', 'equal', 'locationTarget'].every(key => locationUI.controls[key].disabled));
assert.equal(locationUI.controls.locationTarget.label.hidden, true);
// Updating the result must not rebuild selects or discard their focus/values.
assert.equal(locationUI.root.innerHTML, originalMarkup);
for (const [key, control] of Object.entries(originalControls)) assert.equal(locationUI.controls[key], control);
assert.match(originalMarkup, /总体 \/ 处理条件数/);
assert.match(originalMarkup, /对称中心（已有对称性依据）/);

const handbook = readFileSync(new URL('../content/handbook.html', import.meta.url), 'utf8');
const methodMap = handbook.match(/<section id="method-map"[\s\S]*?<\/section>/)[0];
assert.match(methodMap, /独立、正态、共同 residual variance/);
assert.match(methodMap, /不要求先拒绝 omnibus/);
assert.match(methodMap, /SE=√\[cᵀCov\(β̂\)c\]/);
assert.match(methodMap, /每单位记录一对 \(X,Y\) 本身不意味着误差相关/);
assert.match(methodMap, /独立组 Brown–Forsythe 都不能直接分析相关原始行/);
for (const match of methodMap.matchAll(/href="chapters\/(\d+)\.html#([^"]+)"/g)) assert.ok(anchors.get(match[1])?.has(match[2]), match[0]);
console.log('All 180 original + 108 location chooser combinations, exact lesson/subheading links, boundary labels, stable controls and cross-goal transitions passed.');
