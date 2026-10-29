import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { mergePracticeActions } from '../assets/learning.mjs';

const ids = ['p01-01', 'p01-02', 'p04-01'];
const source = readFileSync(new URL('../assets/learning.mjs', import.meta.url), 'utf8').replace(/\bexport /g, '');
class Element {
  constructor(text = '') {
    this.textContent = text; this.events = {}; this.dataset = {}; this.attrs = {};
    this.children = []; this.selectors = {}; this.lists = {}; this.value = ''; this.hidden = false;
  }
  querySelector(selector) { return this.selectors[selector] || null; }
  querySelectorAll(selector) { return this.lists[selector] || []; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  addEventListener(name, callback) { this.events[name] = callback; }
  reset() { this.answer = ''; }
  scrollIntoView() {}
}
class SharedStorage {
  constructor(raw = '{}') { this.raw = raw; this.tabs = []; this.queue = []; this.writes = 0; }
  connect(tab) {
    const shared = this;
    tab.storage = {
      getItem() { if (tab.denyRead) throw Error('Read denied'); return shared.raw; },
      setItem(key, value) {
        if (tab.denyWrite) throw Error('Write denied');
        shared.writes++; shared.raw = value;
        for (const other of shared.tabs) if (other !== tab) shared.queue.push(() => other.events.storage({key, newValue: value, storageArea: other.storage}));
      }
    };
    this.tabs.push(tab);
  }
  flush() { for (const deliver of this.queue.splice(0)) deliver(); }
  records() { return JSON.parse(this.raw); }
}
function page(shared, { denyRead = false, denyWrite = false } = {}) {
  const tab = { events: {}, denyRead, denyWrite }, els = {}, app = new Element();
  const cards = ids.map((id, index) => {
    const card = new Element(`Question ${id}`); card.id = id; card.dataset = {chapter: index < 2 ? '01' : '04', level: '基础'};
    for (const selector of ['.exercise-solution', '.exercise-state', '.bookmark', '.answer-form', '.answer-feedback', '.answer-availability']) card.selectors[selector] = new Element();
    card.selectors['.exercise-solution'].open = true;
    card.lists.details = [card.selectors['.exercise-solution']];
    card.lists['.answer-form input, .answer-form button'] = [new Element(), new Element()];
    return card;
  });
  app.lists['.exercise'] = cards; els['#practice-app'] = app;
  for (const name of ['storage', 'progress', 'meter', 'result-count', 'empty', 'search']) els['#practice-' + name] = new Element();
  for (const [name, values] of Object.entries({chapter: ['all', '01', '04'], level: ['all', '基础'], status: ['all', 'correct', 'review', 'unanswered']})) {
    const control = els['#practice-' + name] = new Element(); control.options = values.map(value => ({value})); control.value = 'all';
  }
  app.lists['.study-toolbar input, .study-toolbar select'] = ['chapter', 'level', 'status', 'search'].map(name => els['#practice-' + name]);
  for (const name of ['mixed-practice', 'all-practice']) els['#' + name] = new Element();
  els['#practice-grading'] = new Element(JSON.stringify(Object.fromEntries(ids.map(id => [id, {type: 'numeric', answer: 1, tolerance: .001}]))));
  const location = new URL('https://isolated.test/practice.html');
  class FormDataFixture { constructor(form) { this.form = form; } get() { return this.form.answer; } }
  shared.connect(tab);
  vm.runInNewContext(source, {
    document: {querySelector: selector => els[selector] || null, querySelectorAll: () => []},
    localStorage: tab.storage, location, history: {replaceState(state, title, href) { location.href = href; }},
    window: {addEventListener(name, callback) { tab.events[name] = callback; }},
    URL, URLSearchParams, FormData: FormDataFixture, Math: Object.assign(Object.create(Math), {random: () => 0})
  });
  return Object.assign(tab, {
    els, cards, location,
    answer(index, value = '1') { const form = cards[index].selectors['.answer-form']; form.answer = value; form.events.submit({currentTarget: form, preventDefault() {}}); },
    bookmark(index) { cards[index].selectors['.bookmark'].events.click(); },
    filter(name, value) { els['#practice-' + name].value = value; els['#practice-' + name].events.input(); }
  });
}

// Two stale pages must not replace each other's question records or fields.
const shared = new SharedStorage(), a = page(shared), b = page(shared);
a.answer(0); b.bookmark(1);
assert.equal(shared.records()[ids[0]].correct, true);
assert.equal(shared.records()[ids[1]].bookmark, true);
// Delayed storage events describe old snapshots; read current storage instead.
shared.flush();
for (const tab of [a, b]) {
  assert.match(tab.els['#practice-progress'].textContent, /已练 1 \/ 3 题 · 当前答对 1/);
  assert.equal(tab.cards[1].selectors['.bookmark'].attrs['aria-pressed'], 'true');
}
a.answer(0, '0'); b.bookmark(0);
assert.equal(shared.records()[ids[0]].attempts, 2);
assert.equal(shared.records()[ids[0]].correct, false);
assert.equal(shared.records()[ids[0]].bookmark, true);
b.answer(0); a.answer(0);
assert.equal(shared.records()[ids[0]].attempts, 4);
assert.equal(shared.records()[ids[0]].correct, true);
assert.equal(shared.records()[ids[0]].bookmark, true);
shared.flush();

// Remote sync changes cumulative state but does not touch ongoing local work.
b.filter('status', 'unanswered');
const card = b.cards[2], form = card.selectors['.answer-form'], solution = card.selectors['.exercise-solution'];
form.answer = 'unfinished expression'; solution.open = true;
card.selectors['.answer-feedback'].textContent = 'Local feedback';
const beforeURL = b.location.href;
a.answer(2); shared.flush();
assert.equal(form.answer, 'unfinished expression'); assert.equal(solution.open, true);
assert.equal(card.selectors['.answer-feedback'].textContent, 'Local feedback');
assert.equal(card.hidden, false); assert.equal(b.location.href, beforeURL);
assert.equal(card.selectors['.exercise-state'].textContent, '已答对');
b.filter('status', 'unanswered'); assert.equal(card.hidden, true);

b.els['#mixed-practice'].events.click();
const challengeCards = b.cards.filter(c => !c.hidden).map(c => c.id), challengeURL = b.location.href;
b.answer(0); const localScore = b.els['#practice-meter'].value;
b.cards[2].selectors['.answer-form'].answer = 'still working';
b.cards[2].selectors['.exercise-solution'].open = true;
a.answer(2, '0'); a.bookmark(2); shared.flush();
assert.deepEqual(b.cards.filter(c => !c.hidden).map(c => c.id), challengeCards);
assert.equal(b.els['#practice-meter'].value, localScore);
assert.match(b.els['#practice-progress'].textContent, /本轮已答 1 \/ 2 题 · 本轮答对 1/);
assert.equal(b.cards[2].selectors['.exercise-state'].textContent, '本轮尚未作答');
assert.equal(b.cards[2].selectors['.bookmark'].attrs['aria-pressed'], 'true');
assert.equal(b.cards[2].selectors['.answer-form'].answer, 'still working');
assert.equal(b.cards[2].selectors['.exercise-solution'].open, true);
assert.equal(b.location.href, challengeURL);

// Failed writes preserve pending local actions; recovery merges, not replaces.
const recovering = new SharedStorage(), c = page(recovering, {denyWrite: true}), d = page(recovering);
c.answer(0); c.bookmark(0);
assert.match(c.els['#practice-storage'].textContent, /未能保存/);
assert.equal(c.cards[0].selectors['.exercise-state'].textContent, '已答对');
d.answer(1); recovering.flush();
assert.equal(c.cards[0].selectors['.exercise-state'].textContent, '已答对');
assert.match(c.els['#practice-progress'].textContent, /已练 2 \/ 3/);
c.denyWrite = false; c.answer(0, '0');
assert.equal(recovering.records()[ids[0]].attempts, 2);
assert.equal(recovering.records()[ids[0]].correct, false);
assert.equal(recovering.records()[ids[0]].bookmark, true);
assert.equal(recovering.records()[ids[1]].correct, true);
assert.equal(c.els['#practice-storage'].textContent, '');
c.bookmark(1); assert.equal(recovering.records()[ids[0]].attempts, 2, 'Pending answers must not replay after a successful save.');

// Read failure must not let an old page overwrite records it cannot inspect.
const unreadable = new SharedStorage(), e = page(unreadable), f = page(unreadable, {denyRead: true});
e.answer(0); const writes = unreadable.writes;
f.answer(1); assert.equal(unreadable.writes, writes);
assert.equal(f.cards[1].selectors['.exercise-state'].textContent, '已答对');
assert.match(f.els['#practice-storage'].textContent, /暂未保存/);
unreadable.flush(); // A denied event read leaves the local pending work intact.
assert.equal(f.cards[1].selectors['.exercise-state'].textContent, '已答对');
f.denyRead = false; f.bookmark(1);
assert.equal(unreadable.records()[ids[0]].correct, true);
assert.equal(unreadable.records()[ids[1]].attempts, 1);
assert.equal(unreadable.records()[ids[1]].bookmark, true);

// A corrupt JSON string is not a storage-permission failure. New progress can
// replace it, including corruption introduced after a page was already open.
const corrupt = new SharedStorage('{unfinished'), g = page(corrupt);
assert.match(g.els['#practice-storage'].textContent, /格式损坏/);
g.answer(0);
assert.equal(corrupt.records()[ids[0]].attempts, 1);
assert.equal(corrupt.records()[ids[0]].correct, true);
assert.equal(g.els['#practice-storage'].textContent, '');
corrupt.raw = 'not JSON'; g.bookmark(1);
assert.equal(corrupt.records()[ids[1]].bookmark, true);
assert.equal(page(corrupt).cards[1].selectors['.bookmark'].attrs['aria-pressed'], 'true');

// Malformed fields in one valid JSON record must not discard healthy records
// or valid fields (such as its bookmark) when the next action is persisted.
const partiallyValid = new SharedStorage(JSON.stringify({
  [ids[0]]: {attempts: 7, correct: true, bookmark: true},
  [ids[1]]: {attempts: 'bad', correct: 'false', bookmark: true},
  [ids[2]]: null,
  unknown: {attempts: 100, correct: true}
}));
const h = page(partiallyValid); h.answer(1);
assert.deepEqual(partiallyValid.records()[ids[0]], {attempts: 7, correct: true, bookmark: true});
assert.deepEqual(partiallyValid.records()[ids[1]], {attempts: 1, correct: true, bookmark: true});
assert.equal(partiallyValid.records()[ids[2]], undefined);
assert.equal(partiallyValid.records().unknown, undefined);

// Ignore unrelated storage; a genuine clear updates cumulative records safely.
const prior = f.els['#practice-progress'].textContent;
f.events.storage({key: 'unrelated', newValue: '{}', storageArea: f.storage});
f.events.storage({key: 'cpsc440-practice-v1', newValue: '{}', storageArea: {}});
assert.equal(f.els['#practice-progress'].textContent, prior);
unreadable.raw = '{}'; f.events.storage({key: null, newValue: null, storageArea: f.storage});
assert.match(f.els['#practice-progress'].textContent, /已练 0 \/ 3/);
assert.deepEqual(mergePracticeActions({[ids[0]]: {attempts: Number.MAX_SAFE_INTEGER, correct: false, bookmark: true}}, ids, [{type: 'answer', id: ids[0], correct: true}]), {
  [ids[0]]: {attempts: Number.MAX_SAFE_INTEGER, correct: true, bookmark: true}
});
console.log('Cross-page field merging, attempt accumulation, delayed events, session/input preservation and failed-storage recovery passed.');
