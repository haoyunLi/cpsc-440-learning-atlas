import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountSearch, searchLessons } from '../assets/search.mjs';

const realIndex = JSON.parse(readFileSync(new URL('../search.json', import.meta.url), 'utf8'));
const realMatches = searchLessons(realIndex, 'variance');
const originalMatches = realIndex.filter(item => `${item.title} ${item.text}`.toLowerCase().includes('variance'));
assert.equal(realMatches.length, originalMatches.length);
assert.ok(realMatches.length >= 63, 'Retain the 63-result variance regression as the index grows');
assert.ok(realMatches.slice(0, 16).some(item => item.url.startsWith('chapters/07.html')),
  'The variance chapter must be reachable on the first page through title relevance');
const titleMatches = originalMatches.filter(item => item.title.toLowerCase().includes('variance'));
assert.deepEqual(realMatches.slice(0, titleMatches.length), titleMatches);
assert.deepEqual(realMatches.slice(titleMatches.length),
  originalMatches.filter(item => !item.title.toLowerCase().includes('variance')));
assert.deepEqual(searchLessons(realIndex, '  VaRiAnCe  '), realMatches);
assert.deepEqual(searchLessons(realIndex, ' '), []);
assert.deepEqual(searchLessons(realIndex, 'a'), []);
assert.deepEqual(searchLessons(realIndex, 'no-matching-concept-98327'), []);
assert.ok(searchLessons(realIndex, '方差').length > 0);

const smallIndex = [
  { title: 'Body first', text: 'variance here', chapter: 'Early', url: 'chapters/01.html#spread' },
  { title: 'Variance title one', text: 'also variance', chapter: 'Later', url: 'chapters/07.html#variance-ci' },
  { title: 'Body second', text: 'variance too', chapter: 'Early', url: 'chapters/05.html#ci' },
  { title: 'Variance title two', text: '', chapter: 'Later', url: 'chapters/07.html#chisquare' }
];
const before = JSON.stringify(smallIndex);
assert.deepEqual(searchLessons(smallIndex, 'variance'), [smallIndex[1], smallIndex[3], smallIndex[0], smallIndex[2]]);
assert.equal(JSON.stringify(smallIndex), before, 'Search must not reorder or alter its input');

// A DOM fixture exercises the module's real loading, pagination and input handlers.
// Rendering layout and native focus visibility are checked separately in a browser.
class Element {
  constructor(tag, document) {
    this.tag = tag;
    this.ownerDocument = document;
    this.children = [];
    this.events = {};
    this.attrs = {};
    this.value = '';
    this.hidden = false;
    this.literalText = '';
  }
  set innerHTML(_) { throw new Error('Search content must never be assigned as HTML'); }
  set textContent(text) { this.literalText = text; this.children = []; }
  get textContent() { return this.literalText + this.children.map(child => child.textContent).join(''); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; this.literalText = ''; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(type, handler) { this.events[type] = handler; }
  focus(options) { this.ownerDocument.activeElement = this; this.focusOptions = options; }
}

function fixture(fetchIndex, query = '') {
  const document = { createElement(tag) { return new Element(tag, this); }, activeElement: null };
  const input = document.createElement('input');
  input.value = query;
  const results = document.createElement('div');
  const { ready } = mountSearch({ input, results, fetchIndex });
  const [status, list, more] = results.children;
  const type = query => { input.value = query; input.events.input(); };
  return { input, results, status, list, more, type, ready, document };
}

let loads = 0;
const app = fixture(() => { loads++; return Promise.resolve(realIndex); }, 'variance');
assert.match(app.status.textContent, /正在读取/);
assert.equal(app.results.attrs['aria-busy'], 'true');
await app.ready;
assert.equal(loads, 1);
assert.equal(app.results.attrs['aria-busy'], 'false');
assert.equal(app.list.children.length, 16);
assert.match(app.status.textContent, new RegExp(`16 / ${realMatches.length}`));
const firstLink = app.list.children[0];
for (const expected of [32, 48, Math.min(64, realMatches.length)]) {
  app.more.events.click();
  assert.equal(app.list.children.length, expected);
  assert.equal(app.list.children[0], firstLink, 'Show more must append, not replace existing results');
  assert.equal(app.document.activeElement, app.more);
  assert.deepEqual(app.more.focusOptions, { preventScroll: true });
}
while (app.list.children.length < realMatches.length) app.more.events.click();
assert.deepEqual(app.list.children.map(link => link.href), realMatches.map(item => item.url));
assert.equal(new Set(app.list.children.map(link => link.href)).size, realMatches.length);
assert.match(app.status.textContent, new RegExp(`${realMatches.length} / ${realMatches.length}`));
assert.equal(app.more.attrs['aria-disabled'], 'true');
assert.equal(app.more.hidden, false);
assert.equal(app.document.activeElement, app.more);
app.more.events.click();
assert.equal(app.list.children.length, realMatches.length);

app.type('ANOVA');
assert.equal(app.list.children.length, Math.min(16, searchLessons(realIndex, 'ANOVA').length));
app.type('variance');
assert.equal(app.list.children.length, 16, 'Changing the query must reset the shown count');
assert.equal(app.more.attrs['aria-disabled'], 'false');
assert.equal(loads, 1, 'Queries and pagination reuse the already-loaded index');
app.type('unmatchable-query-982349');
assert.match(app.status.textContent, /0 条/);
assert.equal(app.list.children.length, 0);
assert.equal(app.more.hidden, true);
app.type('');
assert.equal(app.results.hidden, true);
assert.equal(app.status.textContent, '');

// The pending response must render the latest query, not the query at fetch time.
let resolveIndex;
const pending = fixture(() => new Promise(resolve => { resolveIndex = resolve; }), 'variance');
await Promise.resolve();
pending.type('ANOVA');
assert.match(pending.status.textContent, /正在读取/);
resolveIndex(realIndex);
await pending.ready;
assert.deepEqual(pending.list.children.map(link => link.href),
  searchLessons(realIndex, 'ANOVA').slice(0, 16).map(item => item.url));

for (const load of [
  () => Promise.reject(new Error('Offline')),
  () => { throw new Error('Synchronous load failure'); },
  () => Promise.resolve({}),
  () => Promise.resolve([{ title: 'Missing fields' }]),
  () => Promise.resolve([{ ...smallIndex[0], url: 'javascript:alert(1)' }]),
  () => Promise.resolve([{ ...smallIndex[0], url: '//example.test/unsafe' }])
]) {
  const failed = fixture(load);
  await failed.ready;
  assert.match(failed.status.textContent, /索引未载入/);
  assert.equal(failed.results.hidden, false);
  assert.equal(failed.results.attrs['aria-busy'], 'false');
  assert.equal(failed.list.children.length, 0);
  assert.equal(failed.more.hidden, true);
  failed.type('variance');
  assert.match(failed.status.textContent, /索引未载入/);
}

const literal = '<img src=x onerror=alert(1)> variance';
const safe = fixture(() => Promise.resolve([{ ...smallIndex[0], title: literal, chapter: '<script>not HTML</script>' }]), 'variance');
await safe.ready;
assert.equal(safe.list.children[0].literalText, literal);
assert.equal(safe.list.children[0].children[0].literalText, '<script>not HTML</script>');
assert.equal(safe.list.children[0].children.length, 1);
assert.equal(safe.more.hidden, true);

console.log(`${realMatches.length} real variance matches remain reachable; title priority, stable order, pagination, focus, latest query, loading/error states and literal text passed.`);
