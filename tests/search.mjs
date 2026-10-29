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

// Detailed subsection hits retain precise anchors and readable parent context.
// Compare canonical URLs too, so equivalent relative spellings cannot duplicate a result.
assert.equal(new Set(realIndex.map(item => new URL(item.url, 'https://atlas.invalid/').href)).size,
  realIndex.length, 'Every search entry must have a unique destination');
const subsectionCases = [
  { query: '追踪一个观测', parentUrl: 'chapters/08.html#diagnostics',
    childUrl: 'chapters/08.html#qq-point-walkthrough' },
  { query: '整个 cell 没有观测', parentUrl: 'chapters/14.html#unbalanced',
    childUrl: 'chapters/14.html#empty-factorial-cell' },
  { query: 'coefficient CI', parentUrl: 'chapters/11.html#regression-anova' }
];
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const { query, parentUrl, childUrl } of subsectionCases) {
  const parent = realIndex.find(item => item.url === parentUrl);
  assert.ok(parent, `Keep the full parent lesson for ${query}`);
  const chapterPath = parentUrl.split('#')[0];
  const children = realIndex.filter(item => item.url.startsWith(`${chapterPath}#`)
    && item.url !== parentUrl && item.title.toLowerCase().includes(query.toLowerCase()));
  assert.equal(children.length, 1, `One exact subsection title should match ${query}`);
  const child = children[0];
  if (childUrl) assert.equal(child.url, childUrl, `Preserve the authored anchor for ${query}`);
  assert.ok(child.chapter.includes(parent.title), `Show the parent lesson context for ${query}`);
  assert.ok(child.chapter.includes(parent.chapter), `Keep the chapter context for ${query}`);
  const matches = searchLessons(realIndex, query);
  assert.equal(matches[0], child, `The specific subsection title leads the results for ${query}`);
  assert.ok(matches.indexOf(parent) > matches.indexOf(child),
    `Retain the parent body hit after the specific subsection for ${query}`);

  // Resolve the actual generated heading inside the parent lesson, including a generated ID.
  const fragment = decodeURIComponent(new URL(child.url, 'https://atlas.invalid/').hash.slice(1));
  assert.ok(fragment, `The subsection has a nonempty fragment for ${query}`);
  const page = readFileSync(new URL(`../${chapterPath}`, import.meta.url), 'utf8');
  const parentFragment = parentUrl.split('#')[1];
  const parentStart = page.indexOf(`<section class="lesson" id="${parentFragment}">`);
  assert.ok(parentStart >= 0, `The parent section exists for ${query}`);
  const nextLesson = page.indexOf('<section class="lesson"', parentStart + 1);
  const parentMarkup = page.slice(parentStart, nextLesson < 0 ? page.length : nextLesson);
  assert.match(parentMarkup, new RegExp(`<h[34]\\b[^>]*\\bid=(["'])${escapeRegExp(fragment)}\\1`),
    `The result must land on a real heading within its parent lesson for ${query}`);
}

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

function fixture(fetchIndex, query = '', queryLocation) {
  const document = { createElement(tag) { return new Element(tag, this); }, activeElement: null };
  const input = document.createElement('input');
  input.value = query;
  const results = document.createElement('div');
  const { ready } = mountSearch({ input, results, fetchIndex, queryLocation });
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

// A small browser adapter models URL updates and both history restoration events.
function browserFixture(href) {
  const listeners = new Map(), writes = [];
  const control = { denyWrite: false };
  const browser = {
    location: { href },
    history: {
      state: { reader: { section: 'path' } },
      replaceState(state, title, url) {
        writes.push({ state, title, url });
        if (control.denyWrite) throw new Error('History denied');
        this.state = state;
        browser.location.href = new URL(url, browser.location.href).href;
      },
      pushState() { assert.fail('Typing must not create history entries'); }
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    }
  };
  const dispatch = type => { for (const listener of listeners.get(type) || []) listener({ type }); };
  const visit = (url, event) => {
    browser.location.href = new URL(url, browser.location.href).href;
    if (event) dispatch(event);
  };
  return { browser, writes, control, visit, dispatch };
}

const specialQuery = '方差 + CI & 均值＋α';
const specialIndex = [{ title: specialQuery, text: '', chapter: 'Chapter context', url: 'chapters/07.html#variance-ci' }];
const encoded = browserFixture('https://example.test/atlas/index.html?source=course&tag=a&tag=b#path');
const originalState = encoded.browser.history.state;
const persisted = fixture(() => Promise.resolve(specialIndex), 'native-autofill', encoded.browser);
assert.equal(persisted.input.value, '', 'An initial URL without q means an empty query');
await persisted.ready;
persisted.type(specialQuery);
const saved = new URL(encoded.browser.location.href);
assert.equal(saved.searchParams.get('q'), specialQuery, 'Chinese, literal plus and ampersand round-trip through q');
assert.match(saved.search, /%2B/);
assert.match(saved.search, /%26/);
assert.equal(saved.pathname, '/atlas/index.html');
assert.equal(saved.searchParams.get('source'), 'course');
assert.deepEqual(saved.searchParams.getAll('tag'), ['a', 'b']);
assert.equal(saved.hash, '#path');
assert.equal(encoded.browser.history.state, originalState);
assert.equal(encoded.writes.length, 1);
assert.equal(encoded.writes[0].state, originalState);
assert.equal(persisted.list.children[0].href, specialIndex[0].url);
persisted.type(specialQuery);
assert.equal(encoded.writes.length, 1, 'An unchanged q needs no new history write');
const reloaded = fixture(() => Promise.resolve(specialIndex), '', encoded.browser);
await reloaded.ready;
assert.equal(reloaded.input.value, specialQuery);
assert.equal(reloaded.list.children[0].href, specialIndex[0].url);
assert.equal(encoded.writes.length, 1, 'Restoring the URL must not rewrite history');
persisted.type('');
const cleared = new URL(encoded.browser.location.href);
assert.equal(cleared.searchParams.has('q'), false, 'Clearing the input removes q');
assert.equal(cleared.searchParams.get('source'), 'course');
assert.deepEqual(cleared.searchParams.getAll('tag'), ['a', 'b']);
assert.equal(cleared.hash, '#path');
assert.equal(encoded.browser.history.state, originalState);
assert.equal(persisted.results.hidden, true);

const navigation = browserFixture('https://example.test/atlas/index.html?source=course&q=coefficient+CI#path');
let navigationLoads = 0;
const returning = fixture(() => { navigationLoads++; return Promise.resolve(realIndex); }, '', navigation.browser);
assert.equal(returning.input.value, 'coefficient CI');
assert.match(returning.status.textContent, /正在读取/);
await returning.ready;
const exactChild = searchLessons(realIndex, 'coefficient CI')[0].url;
assert.equal(returning.list.children[0].href, exactChild);
const homeURL = navigation.browser.location.href;
navigation.visit(returning.list.children[0].href);
returning.input.value = '';
navigation.visit(homeURL, 'pageshow');
assert.equal(returning.input.value, 'coefficient CI', 'Returning from a child restores a cleared native input');
assert.equal(returning.list.children[0].href, exactChild);
assert.equal(returning.results.hidden, false);
// Native history restoration can update the form before the navigation event.
returning.input.value = 'variance';
navigation.visit('?source=course&q=variance#path', 'popstate');
assert.equal(returning.input.value, 'variance');
assert.equal(returning.list.children.length, 16);
assert.deepEqual(returning.list.children.map(link => link.href), realMatches.slice(0, 16).map(item => item.url),
  'An already-restored input still updates results that belong to the previous query');
returning.more.events.click();
assert.equal(returning.list.children.length, 32);
const restoredFirstLink = returning.list.children[0];
navigation.dispatch('pageshow');
assert.equal(returning.list.children.length, 32, 'An unchanged restored query preserves the displayed page');
assert.equal(returning.list.children[0], restoredFirstLink);
navigation.visit('?source=course#path', 'popstate');
assert.equal(returning.input.value, '');
assert.equal(returning.results.hidden, true);
assert.equal(navigationLoads, 1);
assert.equal(navigation.writes.length, 0, 'History navigation and restoration never write another history entry');

let resolveRestoredIndex;
const pendingNavigation = browserFixture('https://example.test/atlas/index.html?q=variance');
const restoringPending = fixture(() => new Promise(resolve => { resolveRestoredIndex = resolve; }), '', pendingNavigation.browser);
await Promise.resolve();
pendingNavigation.visit('?q=coefficient+CI', 'popstate');
assert.equal(restoringPending.input.value, 'coefficient CI');
assert.match(restoringPending.status.textContent, /正在读取/);
resolveRestoredIndex(realIndex);
await restoringPending.ready;
assert.equal(restoringPending.list.children[0].href, exactChild, 'A pending index renders the restored query');
assert.equal(pendingNavigation.writes.length, 0);

const deniedHistory = browserFixture('https://example.test/atlas/index.html?source=course#path');
const deniedURL = deniedHistory.browser.location.href;
const deniedState = deniedHistory.browser.history.state;
deniedHistory.control.denyWrite = true;
const usable = fixture(() => Promise.resolve(realIndex), '', deniedHistory.browser);
await usable.ready;
usable.type('variance');
assert.equal(usable.input.value, 'variance');
assert.equal(usable.list.children.length, 16, 'Denied history writes do not block the current search');
usable.more.events.click();
assert.equal(usable.list.children.length, 32);
assert.equal(deniedHistory.browser.location.href, deniedURL);
assert.equal(deniedHistory.browser.history.state, deniedState);
usable.type('');
assert.equal(usable.results.hidden, true);

console.log(`${realMatches.length} real variance matches remain reachable; title priority, stable order, pagination, focus, latest query, loading/error states and literal text passed.`);
console.log('URL query round-trips, clear, unchanged parameters/hash/state, back restoration, pending fetch and denied history writes passed.');
