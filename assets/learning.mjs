const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const key = 'cpsc440-practice-v1';

export function normalizePracticeProgress(value, questionIds) {
  const records = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return records;
  for (const id of questionIds) {
    const saved = Object.hasOwn(value, id) ? value[id] : null;
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) continue;
    const attempts = Number.isSafeInteger(saved.attempts) && saved.attempts > 0 ? saved.attempts : 0;
    const correct = attempts > 0 && saved.correct === true;
    const bookmark = saved.bookmark === true;
    if (attempts || bookmark) records[id] = {attempts, correct, bookmark};
  }
  return records;
}

export function practiceLocation(href, { chapter = 'all', level = 'all', status = 'all', query = '', mixed = false, question = '' } = {}) {
  const url = new URL(href);
  for (const name of ['chapter', 'level', 'status', 'q', 'mode', 'answer']) url.searchParams.delete(name);
  for (const [name, value] of Object.entries({ chapter, level, status })) if (value !== 'all') url.searchParams.set(name, value);
  if (query.trim()) url.searchParams.set('q', query.trim());
  if (mixed && !question) url.searchParams.set('mode', 'mixed');
  url.hash = question ? '#' + question : '';
  return url.href;
}

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

export function answerFeedback(question, raw) {
  const result = gradeAnswer(question, raw);
  if (!result.valid) return '请先选择答案或填写一个有效数值。小数请使用点，不要加单位或百分号。';
  const value = Number(String(raw).trim().replace(/−/g, '-'));
  const explanation = question.type === 'choice' ? question.optionExplanations?.[value] : '';
  if (result.correct) return `答对了。${explanation || '再解释一次为什么用这个方法，并对照完整推导检查思路。'}`;
  if (explanation) return `这个选项不符合题意。${explanation} 这道题已进入“待复习”。`;
  const mistake = question.commonMistakes?.find(m => Math.abs(value - m.value) <= m.tolerance + Number.EPSILON * Math.max(1, Math.abs(value)));
  if (mistake) return `${mistake.feedback} 可以修改答案后再检查；这道题已进入“待复习”。`;
  if (question.integer && !Number.isInteger(value)) return '这道题要求整数。若在规划样本量，先按要求向上取整；若在计算自由度，检查独立信息与估计参数的数量。';
  return '还不一致。核查参数、方向、df、单位与允许误差，再打开提示或逐步解析。这道题已进入“待复习”。';
}

function addSolutionSteps(card) {
  const solution = $('.exercise-solution', card), steps = $$('.solution-steps > li', solution), tail = $('.solution-tail', solution);
  if (!steps.length || !tail) return () => {};
  const controls = document.createElement('div');
  controls.className = 'solution-nav';
  controls.innerHTML = '<div class="study-actions"><button type="button" class="secondary" data-solution="mode" aria-pressed="false">一步一步看</button><button type="button" class="secondary" data-solution="previous" hidden>上一步</button><button type="button" data-solution="next" hidden>下一步</button></div><p class="solution-step-status status" aria-live="polite"></p>';
  $('summary', solution).after(controls);
  const mode = $('[data-solution="mode"]', controls), previous = $('[data-solution="previous"]', controls), next = $('[data-solution="next"]', controls);
  let current = 0, guided = false;
  function render() {
    steps.forEach((step, i) => { step.hidden = guided && i !== current; step.value = i + 1; });
    tail.hidden = guided && current < steps.length - 1;
    previous.hidden = next.hidden = !guided;
    previous.disabled = current === 0; next.disabled = current === steps.length - 1;
    mode.textContent = guided ? '显示完整过程' : '一步一步看';
    mode.setAttribute('aria-pressed', String(guided));
    $('.solution-step-status', controls).textContent = guided ? `第 ${current + 1} / ${steps.length} 步 · ${$('h4', steps[current]).textContent}${current === steps.length - 1 ? '。下面可继续核对结论、误区与 R。' : '。先用自己的话解释，再进入下一步。'}` : '';
  }
  mode.onclick = () => { guided = !guided; current = 0; render(); };
  previous.onclick = () => { current = Math.max(0, current - 1); render(); };
  next.onclick = () => { current = Math.min(steps.length - 1, current + 1); render(); };
  return () => { guided = false; current = 0; render(); };
}

if (typeof document !== 'undefined') {
  const app = $('#practice-app');
  if (app) {
    const grading = JSON.parse($('#practice-grading').textContent);
    const cards = $$('.exercise', app);
    const resetSolutions = new Map(cards.map(card => [card.id, addSolutionSteps(card)]));
    let records = {}, session = null, sessionRecords = {};
    try { records = normalizePracticeProgress(JSON.parse(localStorage.getItem(key) || '{}'), cards.map(card => card.id)); }
    catch { $('#practice-storage').textContent = '浏览器未能读取本地进度；仍可完成练习。'; }
    function save() { try { localStorage.setItem(key, JSON.stringify(records)); } catch { $('#practice-storage').textContent = '浏览器未能保存进度，本次作答仍有效。'; } }
    function record(id) { return records[id] && typeof records[id] === 'object' ? records[id] : {}; }
    function activeRecord(id) { return session ? sessionRecords[id] || {} : record(id); }
    function updateDashboard() {
      const correct = cards.filter(c => record(c.id).correct).length;
      const attempted = cards.filter(c => record(c.id).attempts > 0).length;
      const current = session ? cards.filter(c => session.has(c.id)) : cards;
      const sessionAttempted = current.filter(c => activeRecord(c.id).attempts > 0).length;
      const sessionCorrect = current.filter(c => activeRecord(c.id).correct).length;
      $('#practice-progress').textContent = session ? `本轮已答 ${sessionAttempted} / ${session.size} 题 · 本轮答对 ${sessionCorrect} 题。累计已练 ${attempted} / ${cards.length} 题。` : `已练 ${attempted} / ${cards.length} 题 · 当前答对 ${correct} 题`;
      $('#practice-meter').max = current.length;
      $('#practice-meter').value = sessionCorrect;
      $('#practice-meter').setAttribute('aria-label', session ? '本轮答对的题目比例' : '已答对的题目比例');
      cards.forEach(c => {
        const r = activeRecord(c.id), saved = record(c.id);
        $('.exercise-state', c).textContent = (session ? '本轮' : '') + (r.correct ? '已答对' : r.attempts ? '待复习' : '尚未作答');
        c.dataset.result = r.correct ? 'correct' : r.attempts ? 'review' : 'new';
        $('.bookmark', c).setAttribute('aria-pressed', String(!!saved.bookmark));
        $('.bookmark', c).textContent = saved.bookmark ? '已加入复习' : '加入复习';
      });
    }
    function filter() {
      const chapter = $('#practice-chapter').value, level = $('#practice-level').value, state = $('#practice-status').value;
      const query = $('#practice-search').value.trim().toLowerCase();
      let count = 0;
      cards.forEach(c => {
        const r = activeRecord(c.id);
        const matches = (!session || session.has(c.id)) && (chapter === 'all' || chapter === c.dataset.chapter) && (level === 'all' || level === c.dataset.level) && (!query || c.textContent.toLowerCase().includes(query)) && (state === 'all' || state === 'correct' && r.correct || state === 'unanswered' && !r.attempts || state === 'review' && (record(c.id).bookmark || r.attempts && !r.correct));
        c.hidden = !matches;
        if (matches) count++;
      });
      $('#practice-result-count').textContent = `显示 ${count} 道题`;
      $('#practice-empty').hidden = count > 0;
    }
    function resetFilters() { ['chapter', 'level', 'status'].forEach(k => $('#practice-'+k).value = 'all'); $('#practice-search').value = ''; }
    function syncLocation(question = '') {
      const href = practiceLocation(location.href, {
        chapter: $('#practice-chapter').value, level: $('#practice-level').value, status: $('#practice-status').value,
        query: $('#practice-search').value, mixed: !!session, question
      });
      // Replace the current entry so typing a search does not flood history.
      if (href !== location.href) history.replaceState(null, '', href);
    }
    cards.forEach(c => {
      $('.answer-form', c).addEventListener('submit', event => {
        event.preventDefault();
        const raw = new FormData(event.currentTarget).get('answer');
        const result = gradeAnswer(grading[c.id], raw);
        const feedback = $('.answer-feedback', c);
        if (!result.valid) { feedback.textContent = answerFeedback(grading[c.id], raw); feedback.dataset.correct = 'false'; return; }
        records[c.id] = {...record(c.id), attempts: Math.min(Number.MAX_SAFE_INTEGER, (record(c.id).attempts || 0) + 1), correct: result.correct};
        if (session) sessionRecords[c.id] = {attempts: (sessionRecords[c.id]?.attempts || 0) + 1, correct: result.correct};
        feedback.textContent = answerFeedback(grading[c.id], raw);
        feedback.dataset.correct = String(result.correct);
        save(); updateDashboard();
        // Keep the current question visible so feedback does not disappear under a state filter.
      });
      $('.bookmark', c).addEventListener('click', () => { records[c.id] = {...record(c.id), bookmark: !record(c.id).bookmark}; save(); updateDashboard(); });
    });
    $$('.study-toolbar input, .study-toolbar select', app).forEach(el => el.addEventListener('input', () => { filter(); syncLocation(); }));
    function mixed(reset = true, sync = true) {
      if (reset) resetFilters();
      session = new Set(); sessionRecords = {};
      [...new Set(cards.map(c => c.dataset.chapter))].forEach(ch => { const pool = cards.filter(c => c.dataset.chapter === ch); session.add(pool[Math.floor(Math.random() * pool.length)].id); });
      cards.filter(c => session.has(c.id)).forEach(c => {
        $('.answer-form', c).reset();
        $('.answer-feedback', c).textContent = '';
        resetSolutions.get(c.id)();
        $$('details', c).forEach(d => d.open = false);
      });
      updateDashboard(); filter();
      if (sync) syncLocation();
    }
    $('#mixed-practice').addEventListener('click', () => mixed());
    $('#all-practice').addEventListener('click', () => { session = null; resetFilters(); updateDashboard(); filter(); syncLocation(); });
    const params = new URLSearchParams(location.search);
    for (const name of ['chapter', 'level', 'status']) {
      const select = $('#practice-' + name);
      if ([...select.options].some(o => o.value === params.get(name))) select.value = params.get(name);
    }
    if (params.get('q')) $('#practice-search').value = params.get('q');
    updateDashboard(); filter();
    if (params.get('mode') === 'mixed') mixed(false, false);
    function revealHash() {
      const card = cards.find(c => '#' + c.id === location.hash);
      if (card) {
        session = null; resetFilters(); $('#practice-chapter').value = card.dataset.chapter;
        filter(); updateDashboard(); syncLocation(card.id); card.scrollIntoView({block: 'start'});
        return true;
      }
      return false;
    }
    if (!revealHash()) syncLocation();
    window.addEventListener('hashchange', revealHash);
    // Static HTML stays readable and safe if the module fails to load or start.
    cards.forEach(card => {
      $$('.answer-form input, .answer-form button', card).forEach(control => control.disabled = false);
      $('.answer-availability', card).hidden = true;
    });
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
