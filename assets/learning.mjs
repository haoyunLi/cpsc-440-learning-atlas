const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const key = 'cpsc440-practice-v1';

export function gradeAnswer(question, raw) {
  if (raw == null || String(raw).trim() === '') return {valid: false, correct: false};
  const normalized = String(raw).trim().replace(/−/g, '-');
  // Refuse partial strings and locale-ambiguous commas instead of silently changing a value.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized)) return {valid: false, correct: false};
  const value = Number(normalized);
  if (!Number.isFinite(value)) return {valid: false, correct: false};
  if (question.integer && !Number.isInteger(value)) return {valid: true, correct: false};
  return {valid: true, correct: question.type === 'choice' ? value === question.answer : Math.abs(value - question.answer) <= (question.tolerance ?? 0.001) + Number.EPSILON * Math.max(1, Math.abs(value))};
}

if (typeof document !== 'undefined') {
  const app = $('#practice-app');
  if (app) {
    const grading = JSON.parse($('#practice-grading').textContent);
    const cards = $$('.exercise', app);
    let records = {}, session = null;
    try { const saved = JSON.parse(localStorage.getItem(key) || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) records = saved; }
    catch { $('#practice-storage').textContent = '浏览器未能读取本地进度；仍可完成练习。'; }
    function save() { try { localStorage.setItem(key, JSON.stringify(records)); } catch { $('#practice-storage').textContent = '浏览器未能保存进度，本次作答仍有效。'; } }
    function record(id) { return records[id] && typeof records[id] === 'object' ? records[id] : {}; }
    function updateDashboard() {
      const correct = cards.filter(c => record(c.id).correct).length;
      const attempted = cards.filter(c => record(c.id).attempts > 0).length;
      $('#practice-progress').textContent = `已练 ${attempted} / ${cards.length} 题 · 当前答对 ${correct} 题${session ? ' · 综合自测模式（每章一题）' : ''}`;
      $('#practice-meter').value = correct;
      cards.forEach(c => {
        const r = record(c.id);
        $('.exercise-state', c).textContent = r.correct ? '已答对' : r.attempts ? '待复习' : '尚未作答';
        c.dataset.result = r.correct ? 'correct' : r.attempts ? 'review' : 'new';
        $('.bookmark', c).setAttribute('aria-pressed', String(!!r.bookmark));
        $('.bookmark', c).textContent = r.bookmark ? '已加入复习' : '加入复习';
      });
    }
    function filter() {
      const chapter = $('#practice-chapter').value, level = $('#practice-level').value, state = $('#practice-status').value;
      const query = $('#practice-search').value.trim().toLowerCase();
      let count = 0;
      cards.forEach(c => {
        const r = record(c.id);
        const matches = (!session || session.has(c.id)) && (chapter === 'all' || chapter === c.dataset.chapter) && (level === 'all' || level === c.dataset.level) && (!query || c.textContent.toLowerCase().includes(query)) && (state === 'all' || state === 'correct' && r.correct || state === 'unanswered' && !r.attempts || state === 'review' && (r.bookmark || r.attempts && !r.correct));
        c.hidden = !matches;
        if (matches) count++;
      });
      $('#practice-result-count').textContent = `显示 ${count} 道题`;
      $('#practice-empty').hidden = count > 0;
    }
    function resetFilters() { ['chapter', 'level', 'status'].forEach(k => $('#practice-'+k).value = 'all'); $('#practice-search').value = ''; }
    cards.forEach(c => {
      $('.answer-form', c).addEventListener('submit', event => {
        event.preventDefault();
        const raw = new FormData(event.currentTarget).get('answer');
        const result = gradeAnswer(grading[c.id], raw);
        const feedback = $('.answer-feedback', c);
        if (!result.valid) { feedback.textContent = '请先选择答案或填写一个有效数值。小数请使用点，不要加单位或百分号。'; feedback.dataset.correct = 'false'; return; }
        records[c.id] = {...record(c.id), attempts: (Number(record(c.id).attempts) || 0) + 1, correct: result.correct};
        feedback.textContent = result.correct ? '答对了。再解释一次为什么用这个方法，并对照完整推导检查思路。' : '还不一致。先核查参数、方向、df 与单位，再打开提示或逐步解析。这道题已进入“待复习”。';
        feedback.dataset.correct = String(result.correct);
        save(); updateDashboard();
        // Keep the current question visible so feedback does not disappear under a state filter.
      });
      $('.bookmark', c).addEventListener('click', () => { records[c.id] = {...record(c.id), bookmark: !record(c.id).bookmark}; save(); updateDashboard(); });
    });
    $$('.study-toolbar input, .study-toolbar select', app).forEach(el => el.addEventListener('input', filter));
    function mixed() {
      resetFilters(); session = new Set();
      [...new Set(cards.map(c => c.dataset.chapter))].forEach(ch => { const pool = cards.filter(c => c.dataset.chapter === ch); session.add(pool[Math.floor(Math.random() * pool.length)].id); });
      cards.filter(c => session.has(c.id)).forEach(c => {
        $('.answer-form', c).reset();
        $('.answer-feedback', c).textContent = '';
        $$('details', c).forEach(d => d.open = false);
      });
      updateDashboard(); filter();
    }
    $('#mixed-practice').addEventListener('click', mixed);
    $('#all-practice').addEventListener('click', () => { session = null; resetFilters(); updateDashboard(); filter(); });
    const params = new URLSearchParams(location.search);
    if ([...$('#practice-chapter').options].some(o => o.value === params.get('chapter'))) $('#practice-chapter').value = params.get('chapter');
    if (params.get('q')) $('#practice-search').value = params.get('q');
    updateDashboard(); filter();
    if (params.get('mode') === 'mixed') mixed();
    function revealHash() { const card = cards.find(c => '#'+c.id === location.hash); if (card) { session = null; resetFilters(); $('#practice-chapter').value = card.dataset.chapter; filter(); updateDashboard(); card.scrollIntoView({block: 'start'}); } }
    revealHash(); window.addEventListener('hashchange', revealHash);
  }
  const glossary = $('#glossary-search');
  if (glossary) glossary.addEventListener('input', () => { let n = 0; $$('.glossary > div').forEach(el => { el.hidden = !el.textContent.toLowerCase().includes(glossary.value.trim().toLowerCase()); if (!el.hidden) n++; }); $('#glossary-count').textContent = `找到 ${n} 个术语`; });
  const resourceChapter = $('#resource-chapter');
  if (resourceChapter) {
    const requested = new URLSearchParams(location.search).get('chapter');
    if ([...resourceChapter.options].some(o => o.value === requested)) resourceChapter.value = requested;
    const filterResources = () => { let count = 0; $$('.resource-item').forEach(el => { el.hidden = resourceChapter.value !== 'all' && !el.dataset.chapters.split(' ').includes(resourceChapter.value); if (!el.hidden) count++; }); $('#resource-count').textContent = `${count} 个辅助资源`; };
    resourceChapter.addEventListener('input', filterResources); filterResources();
  }
  $$('pre').forEach(pre => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'copy-code secondary'; button.textContent = '复制代码';
    button.addEventListener('click', async () => { try { await navigator.clipboard.writeText(pre.textContent); button.textContent = '已复制'; } catch { button.textContent = '请选中代码复制'; } });
    pre.before(button);
  });
}
