import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const questions = JSON.parse(readFileSync(new URL('../content/practice.json', import.meta.url), 'utf8'));
const ids = ['p11-06', 'p06-04', 'p05-03'];
const grading = Object.fromEntries(ids.map(id => [id, questions.find(q => q.id === id)]));
const source = readFileSync(new URL('../assets/learning.mjs', import.meta.url), 'utf8').replace(/\bexport /g, '');

// Mount the actual module with the forms, dashboard, and storage it uses.
class Element {
  constructor(text = '') {
    this.textContent = text; this.events = {}; this.dataset = {}; this.attrs = {};
    this.selectors = {}; this.lists = {}; this.value = ''; this.hidden = false;
  }
  querySelector(selector) { return this.selectors[selector] || null; }
  querySelectorAll(selector) { return this.lists[selector] || []; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  addEventListener(name, listener) { this.events[name] = listener; }
  reset() { this.answer = ''; }
  scrollIntoView() {}
}

class SharedStorage {
  constructor() { this.raw = '{}'; this.tabs = []; this.queue = []; this.writes = 0; }
  connect(tab) {
    tab.storage = {
      getItem: () => this.raw,
      setItem: (key, value) => {
        this.raw = value; this.writes++;
        for (const other of this.tabs) if (other !== tab) {
          this.queue.push(() => other.events.storage({key, storageArea: other.storage}));
        }
      }
    };
    this.tabs.push(tab);
  }
  flush() { for (const deliver of this.queue.splice(0)) deliver(); }
  records() { return JSON.parse(this.raw); }
}

function mount(shared) {
  const tab = {events: {}}, elements = {}, app = new Element();
  const cards = ids.map(id => {
    const card = new Element(grading[id].title); card.id = id;
    card.dataset = {chapter: grading[id].chapter, level: grading[id].level};
    for (const selector of ['.exercise-solution', '.exercise-state', '.bookmark', '.answer-form', '.answer-feedback', '.answer-availability']) {
      card.selectors[selector] = new Element();
    }
    card.lists.details = [card.selectors['.exercise-solution']];
    card.lists['.answer-form input, .answer-form button'] = [new Element(), new Element()];
    return card;
  });
  elements['#practice-app'] = app; app.lists['.exercise'] = cards;
  for (const name of ['storage', 'progress', 'meter', 'result-count', 'empty', 'search']) {
    elements['#practice-' + name] = new Element();
  }
  for (const [name, values] of Object.entries({chapter: ['all', '05', '06', '11'], level: ['all', '基础', '应用', '综合'], status: ['all', 'correct', 'review', 'unanswered']})) {
    const control = elements['#practice-' + name] = new Element();
    control.options = values.map(value => ({value})); control.value = 'all';
  }
  app.lists['.study-toolbar input, .study-toolbar select'] = ['chapter', 'level', 'status', 'search'].map(name => elements['#practice-' + name]);
  for (const name of ['mixed-practice', 'all-practice']) elements['#' + name] = new Element();
  elements['#practice-grading'] = new Element(JSON.stringify(grading));
  const location = new URL('https://isolated.test/practice.html');
  class FormDataFixture {
    constructor(form) { this.form = form; }
    get(name) { assert.equal(name, 'answer'); return this.form.answer ?? null; }
  }
  shared.connect(tab);
  vm.runInNewContext(source, {
    document: {querySelector: selector => elements[selector] || null, querySelectorAll: () => []},
    window: {addEventListener(name, listener) { tab.events[name] = listener; }},
    localStorage: tab.storage, location,
    history: {replaceState(state, title, href) { location.href = href; }},
    URL, URLSearchParams, FormData: FormDataFixture,
    Math: Object.assign(Object.create(Math), {random: () => 0})
  });
  return Object.assign(tab, {
    elements, cards,
    feedback(index) { return cards[index].selectors['.answer-feedback']; },
    state(index) { return cards[index].selectors['.exercise-state'].textContent; },
    edit(index, value, eventName = 'input') {
      const form = cards[index].selectors['.answer-form']; form.answer = value;
      form.events[eventName]({currentTarget: form});
    },
    submit(index, value) {
      const form = cards[index].selectors['.answer-form']; form.answer = value;
      form.events.submit({currentTarget: form, preventDefault() {}});
    },
    mixed() { elements['#mixed-practice'].events.click(); }
  });
}

function assertNeutral(tab, index) {
  assert.match(tab.feedback(index).textContent, /^答案已修改，请重新检查。/);
  assert.match(tab.feedback(index).textContent, /已提交/);
  assert.equal(Object.hasOwn(tab.feedback(index).dataset, 'correct'), false);
}

// First edits are quiet. Invalid checks are cleared without becoming attempts.
const initialStorage = new SharedStorage(), initial = mount(initialStorage);
initial.edit(0, '.97'); initial.edit(1, '0', 'change');
assert.equal(initial.feedback(0).textContent, '');
assert.equal(initial.feedback(1).textContent, '');
assert.equal(initialStorage.writes, 0);
initial.submit(2, 'not a number');
assert.match(initial.feedback(2).textContent, /有效数值/);
assert.equal(initial.feedback(2).dataset.correct, 'false');
initial.edit(2, 'not a number', 'change');
assert.match(initial.feedback(2).textContent, /有效数值/);
assert.equal(initial.feedback(2).dataset.correct, 'false');
initial.edit(2, '62'); assertNeutral(initial, 2);
assert.equal(initial.state(2), '尚未作答');
initial.submit(1, null); initial.edit(1, '2', 'change'); assertNeutral(initial, 1);
assert.deepEqual(initialStorage.records(), {});
assert.equal(initialStorage.writes, 0);

const shared = new SharedStorage(), local = mount(shared), remote = mount(shared);

// A correct right-tail answer must not endorse a newly entered left-tail value.
local.submit(0, String(grading[ids[0]].answer));
assert.match(local.feedback(0).textContent, /^答对了/);
// Enter can submit while the input retains focus; its later blur is not a new edit.
local.edit(0, String(grading[ids[0]].answer), 'change');
assert.match(local.feedback(0).textContent, /^答对了/);
assert.equal(local.feedback(0).dataset.correct, 'true');
const firstRecord = shared.raw, firstWrites = shared.writes;
const firstProgress = local.elements['#practice-progress'].textContent;
local.edit(0, String(grading[ids[0]].commonMistakes[0].value));
assertNeutral(local, 0);
assert.equal(local.state(0), '上次有效提交：已答对');
assert.equal(local.elements['#practice-progress'].textContent, firstProgress);
assert.equal(shared.raw, firstRecord);
assert.equal(shared.writes, firstWrites);
local.edit(0, '0.02'); local.edit(0, '0.03', 'change'); local.edit(0, '');
assertNeutral(local, 0);
assert.equal(shared.raw, firstRecord); assert.equal(shared.writes, firstWrites);

// Invalid checks retain the previous scored history, but their feedback also expires.
local.submit(0, '');
assert.match(local.feedback(0).textContent, /有效数值/);
assert.equal(local.state(0), '上次有效提交：已答对');
local.edit(0, String(grading[ids[0]].answer)); assertNeutral(local, 0);
assert.equal(shared.raw, firstRecord);
local.submit(0, String(grading[ids[0]].answer));
assert.equal(local.feedback(0).dataset.correct, 'true');
assert.equal(local.state(0), '已答对');
assert.equal(shared.records()[ids[0]].attempts, 2);

// Choice feedback must follow the submitted option, never the newly selected one.
local.submit(1, '2');
assert.ok(local.feedback(1).textContent.includes(grading[ids[1]].optionExplanations[2]));
const choiceWrites = shared.writes;
local.edit(1, '0'); local.edit(1, '0', 'change');
assertNeutral(local, 1); assert.equal(shared.writes, choiceWrites);
local.submit(1, '0');
assert.equal(local.feedback(1).dataset.correct, 'false');
assert.ok(local.feedback(1).textContent.includes(grading[ids[1]].optionExplanations[0]));
local.edit(1, '2', 'change'); assertNeutral(local, 1);
assert.equal(local.state(1), '上次有效提交：待复习');

// Cross-tab progress synchronization must not restore feedback for an edited form.
local.edit(0, '0.02565583573908105');
remote.submit(0, String(grading[ids[0]].answer));
remote.submit(1, '2');
shared.flush();
assertNeutral(local, 0); assertNeutral(local, 1);
assert.equal(local.cards[0].selectors['.answer-form'].answer, '0.02565583573908105');
assert.equal(local.state(0), '上次有效提交：已答对');
assert.equal(local.state(1), '上次有效提交：已答对');

// Starting a new round removes checked/edited/invalid feedback without touching history.
local.submit(2, 'bad');
const beforeReset = shared.raw, beforeResetWrites = shared.writes;
local.mixed();
for (let index = 0; index < ids.length; index++) {
  assert.equal(local.feedback(index).textContent, '');
  assert.equal(Object.hasOwn(local.feedback(index).dataset, 'correct'), false);
  assert.equal(local.cards[index].selectors['.answer-form'].answer, '');
  assert.equal(local.state(index), '本轮尚未作答');
}
assert.equal(shared.raw, beforeReset); assert.equal(shared.writes, beforeResetWrites);
local.edit(0, '.5'); local.edit(1, '1', 'change'); local.edit(2, '62');
assert.equal(local.feedback(0).textContent, '');
assert.equal(local.feedback(1).textContent, '');
assert.equal(local.feedback(2).textContent, '');
local.submit(0, String(grading[ids[0]].answer));
local.edit(0, '.025'); assertNeutral(local, 0);
assert.equal(local.state(0), '本轮上次有效提交：已答对');
assert.match(local.elements['#practice-progress'].textContent, /本轮已答 1 \/ 3 题 · 本轮答对 1 题/);
local.mixed();
assert.equal(local.feedback(0).textContent, '');
assert.match(local.elements['#practice-progress'].textContent, /本轮已答 0 \/ 3 题 · 本轮答对 0 题/);

console.log('Mounted feedback lifecycle passed: numeric, choice, invalid, quiet first edits, repeated edits, remote sync, and mixed-round reset.');
