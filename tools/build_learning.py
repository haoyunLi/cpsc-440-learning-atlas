"""Build the self-study layer as readable static HTML with progressive enhancement."""
import json
import re


def build_learning(root, chapters, doc, esc):
    by_id = {c['id']: c for c in chapters}
    questions = json.loads((root / 'content/practice.json').read_text()) if (root / 'content/practice.json').exists() else []
    lesson_links = json.loads((root / 'content/practice-links.json').read_text())
    if set(lesson_links) != {q['id'] for q in questions}:
        raise ValueError('Every practice question needs exactly one knowledge-point link in practice-links.json.')
    lesson_titles = {c['id']: {lesson['id']: lesson['title'] for lesson in c['lessons']} for c in chapters}
    chapter_order = {c['id']: i for i, c in enumerate(chapters)}
    questions.sort(key=lambda q: (chapter_order[q['chapter']], q['id']))
    resources = json.loads((root / 'content/resources.json').read_text())
    searches = []
    options = ''.join(f'<option value="{c["id"]}">Ch {"1–3" if c["id"] == "01" else int(c["id"])} · {esc(c["title"])}</option>' for c in chapters)
    cards = []
    for n, q in enumerate(questions, 1):
        qid = q['id']
        anchor = lesson_links[qid]
        if anchor not in lesson_titles[q['chapter']]:
            raise ValueError(f'Unknown knowledge-point link for {qid}: {anchor}')
        lesson_title = lesson_titles[q['chapter']][anchor]
        if q['type'] == 'choice':
            inputs = '<fieldset><legend>选择一个答案</legend>' + ''.join(f'<label class="answer-option"><input type="radio" name="answer" value="{i}"><span>{esc(option)}</span></label>' for i, option in enumerate(q['options'])) + '</fieldset>'
        else:
            inputs = f'<label for="answer-{qid}">填写数值{(" · " + esc(q.get("unit", ""))) if q.get("unit") else ""}</label><input id="answer-{qid}" name="answer" type="text" inputmode="decimal" autocomplete="off" class="study-input" placeholder="按下方误差要求填写数值"><p class="status">允许绝对误差 ±{esc(str(q.get("tolerance", 0.001)))}。</p>'
        if q.get('integer'):
            inputs = inputs.replace('按下方误差要求填写数值', '请输入整数').replace(f'允许绝对误差 ±{q.get("tolerance", 0.001)}。', '答案必须是整数。')
        # Enable answering only after the client has installed its handlers.
        # A missing/failed script must never turn checking into a GET reload.
        inputs = inputs.replace('<input ', '<input disabled ')
        steps = ''.join(f'<li><h4>{esc(s["title"])}</h4>{s["body"]}</li>' for s in q['steps'])
        source = q['source']
        rcode = q.get('rCode', '').replace('\\n', '\n')
        (root / 'downloads' / f'{qid}.R').write_text(rcode + '\n')
        code = f'<details class="r-solution"><summary>用 R 复现</summary><p>在自己的 R 环境中运行；本页不执行 R。</p><pre><code>{esc(rcode)}</code></pre><a href="downloads/{qid}.R" download>下载这道题的 .R 脚本</a></details>' if rcode else ''
        alternatives = ''
        if q.get('optionExplanations'):
            alternatives = '<details class="option-explanations"><summary>逐项比较：每个选项为什么对或错？</summary><dl>'+''.join(f'<dt>{i+1}. {esc(q["options"][i])}</dt><dd>{esc(explanation)}</dd>' for i, explanation in enumerate(q['optionExplanations']))+'</dl></details>'
        if q.get('commonMistakes'):
            alternatives += '<details class="mistake-explanations"><summary>对照常见计算岔路</summary><ul>'+''.join(f'<li><b>若算得约 {m["value"]:.6g}：</b>{esc(m["feedback"])}</li>' for m in q['commonMistakes'])+'</ul><p class="status">相近结果只是检查线索，不能唯一确定你的计算过程。</p></details>'
        cards.append(f'''<article class="exercise" id="{qid}" data-question="{qid}" data-chapter="{q['chapter']}" data-level="{q['level']}">
<div class="exercise-meta"><span>{n:02d} / Ch {"1–3" if q['chapter'] == '01' else int(q['chapter'])} · {esc(q['level'])}</span><span class="exercise-state">尚未作答</span></div>
<h2>{esc(q['title'])}</h2><div class="exercise-prompt">{q['prompt']}</div><p class="status">{' · '.join(esc(t) for t in q['tags'])}</p>
<form class="answer-form"><p class="answer-availability status">自动判题需要 JavaScript；按钮未启用时，可直接阅读下方提示、完整解析与 R。</p>{inputs}<div class="study-actions"><button type="submit" disabled>检查答案</button><button type="button" class="secondary bookmark" aria-pressed="false" disabled>加入复习</button></div><p class="answer-feedback" role="status" aria-live="polite"></p></form>
<details class="exercise-hint"><summary>先给我一个提示</summary><p>{esc(q['hint'])}</p></details>
<details class="exercise-solution"><summary>展开完整解题过程</summary><ol class="solution-steps">{steps}</ol><div class="solution-tail"><p class="solution-conclusion"><b>结论：</b>{q['conclusion']}</p><p class="pitfall"><b>易错点：</b>{q['pitfall']}</p>{alternatives}{code}</div></details>
<p class="exercise-source">题型参考：{esc(source['file'])} · {esc(source['locator'])}。{esc(source['note'].rstrip('。'))}。<a href="chapters/{q['chapter']}.html#{esc(anchor)}">回到对应知识点：{esc(lesson_title)}</a></p></article>''')
        searches.append({'chapter': '练习工坊', 'title': q['title'], 'text': re.sub('<[^>]+>', ' ', q['prompt'] + ' ' + ' '.join(q['tags'])), 'url': f'practice.html#{qid}'})
    grading = {q['id']: {k: q[k] for k in ('type', 'answer', 'tolerance', 'integer', 'optionExplanations', 'commonMistakes') if k in q} for q in questions}
    practice = f'''<main id="main" class="wrap study-page"><div class="study-heading"><h1>把“看懂了”变成“会做了”。</h1><p class="study-lead">{len(questions)} 道分层练习，从方法选择到完整推断。先独立作答，再按需打开提示、逐步解析和 R 复现。</p><p class="status">根据 Homework 0–8、Quiz 1–9 的题型及后续课件原创改编。数值和情境已重写；不作为课程原题答案。</p></div>
<div id="practice-app"><div class="study-toolbar"><label>章节<select id="practice-chapter"><option value="all">全部章节</option>{options}</select></label><label>难度<select id="practice-level"><option value="all">全部难度</option><option>基础</option><option>应用</option><option>综合</option></select></label><label>练习状态<select id="practice-status"><option value="all">全部题目</option><option value="unanswered">尚未作答</option><option value="review">待复习</option><option value="correct">已答对</option></select></label><label>搜索题型<input id="practice-search" type="search" placeholder="例如：power、配对"></label></div>
<p class="status">也可搜索 Homework_6、Quiz_9 等材料编号，定位对应题型。</p><div class="practice-dashboard"><p id="practice-progress" aria-live="polite">进度仅保存在此浏览器。</p><progress id="practice-meter" max="{len(questions)}" value="0" aria-label="已答对的题目比例"></progress><div class="study-actions"><button id="mixed-practice" class="secondary">综合自测 · 每章抽一题</button><button id="all-practice" class="secondary">显示全部题目</button></div><p class="status">刷新综合自测会开始新一轮；累计记录与本轮得分分开计算。</p><p class="status" id="practice-storage" aria-live="polite"></p></div><p id="practice-result-count" role="status"></p><p id="practice-empty" hidden>没有符合条件的题目。调整筛选，或点击“显示全部题目”。</p><noscript><p class="notice">当前未启用 JavaScript，自动判题与筛选不可用；所有题目、提示、解析与 R 代码仍可阅读。</p></noscript><div class="exercise-list">{''.join(cards)}</div></div>
<script type="application/json" id="practice-grading">{json.dumps(grading, ensure_ascii=False).replace('<', chr(92)+'u003c')}</script></main>'''
    (root / 'practice.html').write_text(doc('练习工坊', practice))
    labs = '''<main id="main" class="wrap study-page"><div class="study-heading"><h1>让公式动起来。</h1><p class="study-lead">先做预测，再调整一个参数，最后解释变化。八个工作台连接条件概率、分布、研究设计、数据、变换、秩检验与推断；十个章节实验继续留在正文中。</p></div><nav class="study-jumps" aria-label="实验目录"><a href="#chooser">方法选择</a><a href="#distribution">分布与尾概率</a><a href="#two-sample">两样本分析</a><a href="#diagnostics">模型诊断</a><a href="#contrasts">线性对比</a><a href="#transformations">变换与均值</a><a href="#ranks">精确秩检验</a><a href="#conditional">条件概率</a><a href="#chapter-labs">章节实验</a></nav>
<section id="chooser" class="workbench-section"><h2>01 · 从研究问题选择方法</h2><p>先确定目标、设计和独立单位。向导提供学习入口；最终分析还需要研究背景与模型诊断。</p><div data-workbench="chooser"><p>启用 JavaScript 使用向导，或查阅<a href="handbook.html#method-map">静态方法速查表</a>。</p></div></section>
<section id="distribution" class="workbench-section"><h2>02 · 临界值、尾概率与 P-value</h2><p>挑战：保持 statistic 不变，把 normal 换成 df=5 的 t。尾部发生什么变化？接着改变 α，判断 rejection rule 如何移动。</p><div data-workbench="distribution"><p>启用 JavaScript 操作。分布与尾概率的完整解释在<a href="chapters/05.html#testing">假设检验</a>。</p></div></section>
<section id="two-sample" class="workbench-section"><h2>03 · 同样的数据，不同的实验结构</h2><p>挑战：保持两列数值不变，比较 Welch、pooled 与 paired。SE 为什么不同？只有研究本身存在一一配对时，paired 才合法。</p><div data-workbench="two-sample"><p>启用 JavaScript 输入数据，或阅读<a href="chapters/06.html">两样本推断的完整手算例子</a>。</p></div></section>
<section id="diagnostics" class="workbench-section"><h2>04 · 用残差诊断模型</h2><p>挑战：先观察 Q–Q，再观察 residual vs fitted。一个图接近直线，能否保证另一个条件也成立？不同图回答不同问题。</p><div data-workbench="diagnostics"><p>启用 JavaScript 切换场景，或阅读<a href="chapters/08.html#diagnostics">诊断讲解</a>。</p></div></section>
<section id="contrasts" class="workbench-section"><h2>05 · 从 coefficients 到 simultaneous intervals</h2><p>挑战：全部均值一起平移，为什么 contrast 不变？改变样本量后，为什么两个原本正交的比较不再正交？</p><div data-contrast-lab><p>启用 JavaScript 编辑四组均值、样本量和系数；完整计算与可运行 R 示例见<a href="chapters/09.html#contrast">线性组合与 contrast</a>、<a href="chapters/09.html#procedures">比较方法</a>。</p></div></section>
<section id="transformations" class="workbench-section"><h2>06 · 变换之后，mean 还是同一个 mean 吗？</h2><p>挑战：比较“先变换每个观测，再求均值并回变换”与“直接求原始均值”。把一个观测改大，观察两条路径的差距。</p><div data-transformation-lab><p>启用 JavaScript 编辑数据与切换尺度，或阅读<a href="chapters/08.html#transform">平方根、对数变换与回变换的完整数值例子</a>。</p></div></section>
<section id="ranks" class="workbench-section"><h2>07 · 精确 P 值从哪些分配中数出来？</h2><p>挑战：保留重复值的单位编号，查看每种标签或符号分配。为什么两个相同的 rank sum 仍可能对应两种不同的分配？</p><div data-rank-lab><p>启用 JavaScript 逐个查看全部分配，或阅读<a href="chapters/06.html#rank-sum-ties-exact">带 ties 的 rank-sum 手算</a>与<a href="chapters/06.html#signed-rank-zero-ties">零差、ties 与 signed-rank</a>。</p></div></section>
<section id="conditional" class="workbench-section"><h2>08 · 已知条件改变了哪一个分母？</h2><p>挑战：只交换“已知什么”，为什么同一个交集会得到不同的条件概率？再加载边际总数相同的第二张表，检查独立性有没有改变。</p><div data-conditional-lab><p>启用 JavaScript 编辑频数与切换条件，或阅读<a href="chapters/04.html#conditional">完整列联表与双向条件概率手算</a>。</p></div></section>
<section class="lesson" id="chapter-labs"><h2>继续进入十个章节实验</h2><div class="lab-directory">'''
    lab_names = [('01', 'summary', '数据、分箱与异常值'), ('04', 'probability', 'Binomial 与反复抽样的 CLT'), ('05', 'inference', 'α / β / power 与 CI 重复覆盖'), ('06', 'paired', 'Pairing 与 covariance'), ('07', 'variance', 'χ² 与不对称的 variance CI'), ('08', 'anova', '组间信号与组内 noise'), ('09', 'multiple', '比较次数与 FWER'), ('14', 'factorial', 'Simple effects 与 interaction'), ('15', 'design', 'Blocking 与 Latin square'), ('11', 'regression', 'Least squares、CI 与 PI')]
    labs += ''.join(f'<a href="chapters/{cid}.html#lab-{key}"><span>Ch {"1–3" if cid == "01" else int(cid)}</span>{title} →</a>' for cid, key, title in lab_names)
    labs += '</div></section></main>'
    (root / 'labs.html').write_text(doc('交互实验室', labs))
    handbook = '<main id="main" class="wrap study-page handbook"><div class="study-heading"><h1>一本随时翻开的自学手册。</h1><p class="study-lead">从研究问题到 R 输出，把概念、计算与结论连起来。</p></div><nav class="study-jumps" aria-label="手册目录"><a href="#start">零基础起步</a><a href="#route">学习路线</a><a href="#notation">公式读法</a><a href="#method-map">方法速查</a><a href="#r-start">R 入门</a><a href="#language">结论写作</a><a href="#glossary">术语词典</a></nav>' + (root / 'content/handbook.html').read_text() + '</main>'
    (root / 'handbook.html').write_text(doc('自学手册', handbook))
    resource_html = '<main id="main" class="wrap study-page"><div class="study-heading"><h1>换一种方式理解同一个概念。</h1><p class="study-lead">按问题选择外部视频、可视化和官方文档。每个资源都附一个可以实际完成的小任务。</p><p class="status">链接于 2026-10-28 至 2026-10-29 分批核对。外部资源可能变化，需要网络；站内核心讲解与实验不依赖外部服务。</p></div><label for="resource-chapter">选择正在学习的章节</label><select id="resource-chapter" class="study-input"><option value="all">全部章节</option>'+options+'</select><p id="resource-count" class="status" aria-live="polite"></p><div class="resource-list">'
    for r in resources:
        resource_html += f'<article class="resource-item" data-chapters="{" ".join(r["chapters"])}"><p class="status">{esc(r["kind"])} · {" / ".join("Ch "+("1–3" if x=="01" else str(int(x))) for x in r["chapters"])}</p><h2><a href="{esc(r["url"])}" target="_blank" rel="noopener noreferrer">{esc(r["title"])} ↗</a></h2><p>{esc(r["task"])}</p><p class="status">{esc(r["note"])}</p></article>'
    resource_html += '</div><p><a href="sources.html">课程文件与章节覆盖映射 →</a></p></main>'
    (root / 'resources.html').write_text(doc('辅助学习资源', resource_html))
    handbook_search = [
        ('start', '第一次学：总体、样本与实验单位', 'Population sample parameter statistic experimental unit 零基础'),
        ('notation', '公式怎么读：符号、下标与分位数', 'Sigma Σ 求和 下标 横线 帽子 分位数 quantile parameter statistic μ sigma variance SD SE'),
        ('method-map', '方法速查：先读问题，再读公式', '方法选择 t test ANOVA paired Welch contrast 公式速查'),
        ('r-start', 'R 从零到一个完整分析', 'R 入门 读数据 ANOVA Brown-Forsythe Tukey'),
        ('language', '结论怎么写', '结论写作 P-value confidence interval CI 易错点'),
        ('glossary', '中英术语与符号', 'SD SE residual LSMeans standard error 标准误 术语词典')
    ]
    searches.extend({'chapter': '自学手册', 'title': title, 'text': title + ' ' + keywords, 'url': 'handbook.html#' + anchor} for anchor, title, keywords in handbook_search)
    return searches
