const PAGE_SIZE = 16;
const normalizeQuery = query => typeof query === 'string' ? query.trim().toLowerCase() : '';

// Return every match. Within each relevance tier, preserve the index's order.
export function searchLessons(items, query) {
  const term = normalizeQuery(query);
  if (term.length < 2) return [];
  const titleMatches = [], otherMatches = [];
  for (const item of items) {
    if (item.title.toLowerCase().includes(term)) titleMatches.push(item);
    else if (`${item.title} ${item.text}`.toLowerCase().includes(term)) otherMatches.push(item);
  }
  return [...titleMatches, ...otherMatches];
}

function validIndex(items) {
  return Array.isArray(items) && items.every(item => {
    if (!item || !['title', 'text', 'chapter', 'url'].every(key => typeof item[key] === 'string')) return false;
    // Search links are site-relative paths, never executable or external URLs.
    const url = item.url.trim();
    if (!url || /^[\\/]|^[a-z][a-z\d+.-]*:|\\|[\u0000-\u001f]/i.test(url)) return false;
    try { return new URL(url, 'https://atlas.invalid/').origin === 'https://atlas.invalid'; }
    catch { return false; }
  });
}

export function mountSearch({ input, results, fetchIndex }) {
  const document = results.ownerDocument || input.ownerDocument;
  if (!document || typeof fetchIndex !== 'function') throw new TypeError('Search needs DOM elements and a fetchIndex function.');
  const status = document.createElement('p');
  status.className = 'status search-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const list = document.createElement('div');
  list.className = 'search-matches';
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'secondary search-more';
  more.hidden = true;
  results.replaceChildren();
  results.append(status);
  results.append(list);
  results.append(more);
  // Announce the concise count rather than reading every inserted result again.
  results.setAttribute('aria-live', 'off');

  let items = null, failed = false, matches = [], shown = 0;
  function updateCount() {
    status.textContent = `显示 ${shown} / ${matches.length} 条匹配结果 · 标题命中优先`;
    const remaining = matches.length - shown;
    more.hidden = matches.length <= PAGE_SIZE;
    more.textContent = remaining > 0 ? `显示更多（还有 ${remaining} 条）` : `已显示全部 ${matches.length} 条结果`;
    // Keep the last clicked button focusable when the final page is appended.
    more.setAttribute('aria-disabled', String(remaining === 0));
  }
  function appendPage() {
    const end = Math.min(shown + PAGE_SIZE, matches.length);
    for (const item of matches.slice(shown, end)) {
      const link = document.createElement('a');
      link.className = 'search-result';
      link.href = item.url.trim();
      link.textContent = item.title;
      const chapter = document.createElement('span');
      chapter.textContent = item.chapter;
      link.append(chapter);
      list.append(link);
    }
    shown = end;
    updateCount();
  }
  function render() {
    list.replaceChildren();
    matches = [];
    shown = 0;
    more.hidden = true;
    const term = normalizeQuery(input.value);
    results.hidden = !failed && term.length < 2;
    results.setAttribute('aria-busy', String(!items && !failed));
    if (failed) {
      status.textContent = '搜索索引未载入，请从章节目录阅读。';
      return;
    }
    if (term.length < 2) { status.textContent = ''; return; }
    if (!items) { status.textContent = '正在读取搜索索引…'; return; }
    matches = searchLessons(items, term);
    if (!matches.length) {
      status.textContent = '找到 0 条匹配结果，试试英文 technical term 或中文概念。';
      return;
    }
    appendPage();
  }
  input.addEventListener('input', render);
  more.addEventListener('click', () => {
    if (shown >= matches.length) return;
    appendPage();
    more.focus({ preventScroll: true });
  });
  render();
  const ready = Promise.resolve().then(() => fetchIndex()).then(data => {
    if (!validIndex(data)) throw new TypeError('Invalid search index');
    items = data;
    render();
  }).catch(() => {
    items = null;
    failed = true;
    render();
  });
  return { ready };
}
