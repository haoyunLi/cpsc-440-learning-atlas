from pathlib import Path
import json,re,html,hashlib
from r_examples import add_r_downloads
root=Path(__file__).resolve().parents[1]; ch=sum([json.loads((root/f'content/part{i}.json').read_text()) for i in range(1,4)],[])
for addition in json.loads((root/'content/deepening.json').read_text()) if (root/'content/deepening.json').exists() else []:
 c=next(c for c in ch if c['id']==addition['chapter'])
 c['lessons'].append(addition)
goals=json.loads((root/'content/goals.json').read_text())
figs=json.loads((root/'content/figures.json').read_text())
walks=json.loads((root/'content/walkthroughs.json').read_text())
practice_questions=json.loads((root/'content/practice.json').read_text())
practice_links=json.loads((root/'content/practice-links.json').read_text())
practice_by_lesson={}
for question in practice_questions:
 practice_by_lesson.setdefault((question['chapter'],practice_links[question['id']]),[]).append(question)
def esc(s):return html.escape(s,quote=True)
def version(path):return hashlib.sha256((root/path).read_bytes()).hexdigest()[:10]
def diagram_scene(svg,label):
 return f'<div class="scene">{svg}</div><details class="diagram-zoom"><summary>放大查看图解</summary><div class="zoom-scene" tabindex="0" role="region" aria-label="{label}，可横向移动">{svg}</div><p class="motion-note">可左右滑动；键盘聚焦图后可用左右方向键移动。</p></details>'
def teaching_figures(cid,lid):
 out=''
 for f in figs:
  if (f['chapter'],f['lesson'])!=(cid,lid):continue
  out+=f'<figure class="teaching-figure"><h3>{esc(f["title"])}</h3>{diagram_scene(f["svg"],"放大教学图")}<figcaption>{esc(html.unescape(f["caption"]))}</figcaption></figure>'
 for w in walks:
  if (w['chapter'],w['lesson'])!=(cid,lid):continue
  last=w['frames'][-1]
  steps=''.join(f'<li><p>{esc(html.unescape(f["caption"]))}</p><div class="equation">{esc(html.unescape(f["equation"]))}</div></li>' for f in w['frames'])
  out+=f'<figure class="teaching-figure walkthrough" data-walkthrough="{w["id"]}" data-diagram-version="{version("content/walkthroughs.json")}"><h3>{esc(w["title"])}</h3><p class="figure-intro">{esc(w["description"])}</p>{diagram_scene(last["svg"],"放大分步图")}<div class="walk-controls"></div><figcaption><p class="step-counter" aria-live="polite">完整结果 · 下方可阅读全部步骤</p><p class="step-caption">{esc(html.unescape(last["caption"]))}</p><div class="equation step-equation">{esc(html.unescape(last["equation"]))}</div></figcaption><details><summary>逐条阅读全部 {len(w["frames"])} 个步骤</summary><ol>{steps}</ol></details></figure>'
 return out
def header(prefix='./'):
 links=''.join(f'<a href="{prefix}{url}">{label}</a>' for url,label in [('index.html#path','学习路径'),('practice.html','练习工坊'),('labs.html','交互实验'),('handbook.html','自学手册'),('resources.html','辅助资源')])
 return f'<a class="skip" href="#main">跳到正文</a><header><a class="brand" href="{prefix}index.html">CPSC 440 <span>Atlas</span></a><nav class="desktop-nav" aria-label="主导航">{links}</nav><details class="mobile-menu"><summary>目录</summary><nav aria-label="手机导航">{links}<a href="{prefix}sources.html">来源与使用</a></nav></details></header>'
def footer(prefix='./'):return f'<footer><span>CPSC 440 · Applied Statistical Methods I<br>中文解释 · English technical terms · 原创交互</span><span><a href="{prefix}resources.html">辅助学习资源</a> · <a href="{prefix}sources.html">来源、模型假设与内容边界</a></span></footer>'
def doc(title,body,prefix='./'):
 extra=''
 if 'data-brown-forsythe' in body:
  extra=f'<link rel="stylesheet" href="{prefix}assets/brown-forsythe.css?v={version("assets/brown-forsythe.css")}"><script type="module" src="{prefix}assets/brown-forsythe.mjs?v={version("assets/brown-forsythe.mjs")}"></script>'
 if 'data-lab="factorial"' in body:
  extra+=f'<link rel="stylesheet" href="{prefix}assets/factorial.css?v={version("assets/factorial.css")}">'
 return f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="CPSC 440 农学统计学习图谱：从数据描述、概率推断，到 ANOVA、实验设计与 regression。中文逐步讲解与可操作实验。"><title>{esc(title)} · CPSC 440 Atlas</title><link rel="icon" href="{prefix}assets/favicon.svg"><link rel="stylesheet" href="{prefix}assets/style.css?v={version("assets/style.css")}"><link rel="stylesheet" href="{prefix}assets/learning.css?v={version("assets/learning.css")}"><link rel="stylesheet" href="{prefix}assets/workbench.css?v={version("assets/workbench.css")}"><script type="module" src="{prefix}assets/learning.mjs?v={version("assets/learning.mjs")}"></script><script type="module" src="{prefix}assets/workbench.mjs?v={version("assets/workbench.mjs")}"></script><script type="module" src="{prefix}assets/atlas.mjs?v={version("assets/atlas.mjs")}"></script><script type="module" src="{prefix}assets/contrast.mjs?v={version("assets/contrast.mjs")}"></script><script type="module" src="{prefix}assets/transformation.mjs?v={version("assets/transformation.mjs")}"></script><link rel="stylesheet" href="{prefix}assets/ranks.css?v={version("assets/ranks.css")}"><script type="module" src="{prefix}assets/ranks.mjs?v={version("assets/ranks.mjs")}"></script><link rel="stylesheet" href="{prefix}assets/conditional.css?v={version("assets/conditional.css")}"><script type="module" src="{prefix}assets/conditional.mjs?v={version("assets/conditional.mjs")}"></script><script type="module" src="{prefix}assets/walkthrough.mjs?v={version("assets/walkthrough.mjs")}"></script>{extra}</head><body>{header(prefix)}{body}{footer(prefix)}</body></html>'
svg='''<svg viewBox="0 0 560 390" role="img" aria-labelledby="hero-diagram-title hero-diagram-desc"><title id="hero-diagram-title">从植物观测到统计推断</title><desc id="hero-diagram-desc">观测值沿轴分布，平均值连接样本与抽样分布；置信区间表达估计的不确定性。</desc><g fill="none" stroke="#708b80" stroke-width="1"><path d="M35 135H525M35 305H525"/></g><g fill="#086f68"><circle cx="90" cy="135" r="6"/><circle cx="132" cy="135" r="6"/><circle cx="170" cy="135" r="6"/><circle cx="196" cy="135" r="6"/><circle cx="223" cy="135" r="6"/><circle cx="261" cy="135" r="6"/><circle cx="309" cy="135" r="6"/><circle cx="356" cy="135" r="6"/><circle cx="410" cy="135" r="6"/></g><path d="M245 151V182" stroke="#086f68" stroke-width="2"/><path d="M135 305C175 305 185 217 245 217S315 305 355 305" fill="#bad6c8" stroke="#086f68" stroke-width="2"/><path d="M194 335H296M194 327V343M296 327V343" stroke="#9a472e" stroke-width="3"/><g fill="#183a37" font-family="sans-serif" font-size="15"><text x="35" y="65">OBSERVE</text><text x="35" y="92">单株测量 · observations Yᵢ</text><text x="250" y="178">ȳ</text><text x="35" y="210">INFER</text><text x="360" y="258">Sampling distribution</text><text x="360" y="281">SE = σ / √n</text><text x="162" y="375">Estimate ± uncertainty</text></g></svg>'''
rows=''.join(f'<a class="route" href="chapters/{c["id"]}.html"><span class="num">{i:02}</span><span><h3>{esc(c["title"])}</h3><small>{esc(c["en"])} · 来源 Chapter {"1–3" if c["id"]=="01" else c["id"]}</small></span><p>{esc(c["question"])}</p><span class="arrow"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span></a>' for i,c in enumerate(ch,1))
home=f'''<main id="main"><section class="hero"><div class="hero-inner"><div><h1>让每一个统计结果<br>都有可解释的来路。</h1><p class="english">Applied Statistical Methods I</p><p>先明确研究问题，再看数据如何进入模型。用十个循序渐进的单元，把 probability、inference、ANOVA 与 experimental design 连成一条可操作的学习路径。</p><div class="hero-actions"><a class="action" href="chapters/01.html">从观测开始 <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a><a href="#path">查看完整路径</a></div></div><figure>{svg}<figcaption>观测值、估计值与 sampling distribution 承担不同角色。图中曲线是概念示意，实际推断需要模型条件。</figcaption></figure></div></section><div class="wrap"><nav class="study-entry" aria-label="自主学习入口"><a href="handbook.html"><strong>从零开始</strong><span>概念、方法速查与 R 入门</span></a><a href="practice.html"><strong>动手做题</strong><span>分层练习、提示与逐步解析</span></a><a href="labs.html"><strong>操作实验</strong><span>改变参数，观察推断如何变化</span></a><a href="resources.html"><strong>换个视角</strong><span>视频、可视化与官方文档</span></a></nav><section class="route-intro" id="path"><h2>从“数据是什么”走到“结论为何成立”</h2><p>每个单元依次回答：为什么需要这个方法 → 它如何计算 → 用例 → 条件与误解 → 练习。交互参数直接对应公式，不靠自动动效代替推理。</p><p id="progress-count" class="progress">阅读进度保存在此浏览器。</p></section><nav aria-label="十个学习单元">{rows}</nav><section class="search-section"><h2>从一个概念进入</h2><label for="search">搜索中文概念或英文 term（至少两个字符）</label><input id="search" type="search" placeholder="例如：Welch、interaction、置信区间" autocomplete="off"><div id="search-results" aria-live="polite"></div></section><section class="route-intro"><h2>先选研究问题，再选方法</h2><p>描述数据 → 单个总体中心 → 两个独立或 paired 总体 → 多个 mean → planned comparisons → 多因素与 blocks → 连续关系。Variance 是另一个研究目标，不能被 mean 的检验代替。</p><p class="status">以课程 PPT 与 class notes 的内容并集编写。课程中的重复演算被归并为逐步解释，例子和图形重新创作；原课件、考卷与提交答案不在此站公开。<a href="sources.html">查看来源与内容说明</a>。</p></section></div></main>'''
(root/'index.html').write_text(doc('统计方法学习图谱',home))
(root/'chapters').mkdir(exist_ok=True);search=[]
positions={'01':'boxplot','04':'clt','05':'errors','06':'paired-t','07':'variance-ci','08':'worked','09':'multiplicity','14':'interaction','15':'blocking','11':'prediction'}
for i,c in enumerate(ch):
 nav=''.join(f'<a href="{x["id"]}.html"'+(' class="current" aria-current="page"' if x==c else '')+f'>{j:02} · {esc(x["title"])}</a>' for j,x in enumerate(ch,1))
 toc=''.join(f'<a href="#{l["id"]}">{esc(l["title"])}</a>' for l in c['lessons'])
 article=f'<div class="chapter-title"><h1>{esc(c["title"])}</h1><p class="status">学习单元 {i+1:02} / 10 · Chapter {"1–3" if c["id"]=="01" else c["id"]}</p><p class="english">{esc(c["en"])}</p><p class="question">{esc(c["question"])}</p><p class="bridge">{esc(c["bridge"])}</p></div>'
 article+=f'<section class="chapter-study"><p>学 → 试 → 做 → 讲：读完一节，先用自己的话解释，再调整实验参数，最后独立做题。</p><nav aria-label="本章学习工具"><a href="../practice.html?chapter={c["id"]}">本章练习与逐步解析</a><a href="../labs.html">交互工作台</a><a href="../handbook.html#notation">公式读法</a><a href="../handbook.html#method-map">方法速查</a><a href="../resources.html?chapter={c["id"]}">辅助资源</a></nav></section>'
 article+='<details class="learning-goals"><summary>这一单元，学到什么程度才算掌握？</summary><ul>'+''.join('<li>'+esc(goal)+'</li>' for goal in goals[c['id']])+'</ul><p class="status">先不看答案完成本章练习，并能解释所用条件；标记已读只记录阅读，不等于掌握。</p></details>'
 for lesson_index,l in enumerate(c['lessons']):
  # Normalize intentional code line breaks from the authored JSON.
  body=l['body'].replace('\\n','\n')
  body=add_r_downloads(root,c['id'],l,body)
  if l.get('source'):
   body+='<p class="source-locator">课程定位：'+'；'.join(esc(v['file'])+'，'+esc(str(v['pages'])) for v in l['source'])+'。讲解与例题为重新编写。</p>'
  body=re.sub(r'(<table\b.*?</table>)',r'<div class="table-scroll" tabindex="0" role="region" aria-label="教学数据表，可横向滚动">\1</div>',body,flags=re.S)
  practice_items=practice_by_lesson.get((c['id'],l['id']),[])
  practice_nav=''
  if practice_items:
   practice_nav='<nav class="lesson-practice" aria-label="本节对应练习"><h3>读完这节，独立试一题</h3><p>先自己作答，再按需打开提示或解析。每题都有返回本节的链接。</p><ul>'+''.join(f'<li><a href="../practice.html#{q["id"]}"><span>{esc(q["level"])}</span>{esc(q["title"])}</a></li>' for q in practice_items)+'</ul></nav>'
  next_lesson=c['lessons'][lesson_index+1] if lesson_index+1<len(c['lessons']) else None
  next_link=f'<a href="#{next_lesson["id"]}">下一节：{esc(next_lesson["title"])} →</a>' if next_lesson else ''
  if l['id']==positions[c['id']]:next_link=f'<a href="#lab-{c["sim"]}">接着操作本章实验 →</a>'
  lesson_tools=f'<nav class="lesson-tools" aria-label="本节阅读导航"><a href="#chapter-navigation">↑ 返回章节与本页目录</a>{next_link}</nav>'
  article+=f'<section class="lesson" id="{l["id"]}"><h2>{esc(l["title"])}</h2>{body}{teaching_figures(c["id"],l["id"])}{practice_nav}{lesson_tools}</section>'
  if l['id']==positions[c['id']]:
   article+=f'<section class="lab" id="lab-{c["sim"]}" data-lab="{c["sim"]}" aria-label="{esc(c["en"])} 交互实验"><p>启用 JavaScript 后可调整参数。完整推导与 worked examples 可直接阅读正文。</p></section>'
   if next_lesson:article+=f'<nav class="lesson-tools" aria-label="实验之后继续阅读"><a href="#chapter-navigation">↑ 返回章节与本页目录</a><a href="#{next_lesson["id"]}">继续下一节：{esc(next_lesson["title"])} →</a></nav>'
  search.append({'chapter':c['title'],'title':l['title'],'text':re.sub('<[^>]+>',' ',body),'url':f'chapters/{c["id"]}.html#{l["id"]}'})
 chaptername='1, 2, and 3' if c['id']=='01' else str(int(c['id']))
 article+=f'<section class="sources"><h2>本单元来源</h2><p>Alexander E. Lipka, CPSC 440, Chapter {chaptername} lecture slides；CPSC 440 Chapter {chaptername} class notes。依据二者并集重新组织，公式、解释与交互均为重新编写。部分数字沿用课程的公开教学例题，完整原始课件不转载。</p><a href="../sources.html">核查参考文献、方法边界与覆盖说明 <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a></section><div class="completion"><button id="complete" data-chapter="{c["id"]}">标记此单元已读</button><p class="status" id="progress-error" aria-live="polite"></p></div>'
 previous=f'<a href="{ch[i-1]["id"]}.html"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 5l-7 7 7 7"/></svg> {esc(ch[i-1]["title"])}</a>' if i else '<a href="../index.html"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5M11 5l-7 7 7 7"/></svg> 学习路径</a>'
 nxt=f'<a href="{ch[i+1]["id"]}.html">{esc(ch[i+1]["title"])} <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a>' if i+1<len(ch) else '<a href="../index.html#path">返回学习路径 <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a>'
 article+=f'<nav class="chapter-actions" aria-label="相邻单元">{previous}{nxt}</nav>'
 page=f'<main id="main" class="wrap chapter-layout"><aside class="sidebar" id="chapter-navigation"><details><summary>章节与本页目录</summary><div><nav aria-label="课程章节">{nav}</nav><nav class="toc" aria-label="本页目录">{toc}</nav></div></details></aside><article class="article">{article}</article></main>'
 (root/f'chapters/{c["id"]}.html').write_text(doc(c['title'],page,'../'))
(root/'search.json').write_text(json.dumps(search,ensure_ascii=False))
about='''<main id="main" class="wrap about"><h1>来源与使用说明</h1><p>这是一份独立编写的学习辅助材料，学习目标是理解统计推理的结构。它不是 UIUC 官方课程站，也不替代教师说明。中文解释保留英文 technical terms，以便回到课程材料和软件文档中核对。</p><h2>课程来源</h2><p>Alexander E. Lipka, CPSC 440: Applied Statistical Methods I。Lecture slides：Chapters 1–3, 4, 5, 6, 7, 8, 9, 11, 14, 15；相同章节的 class notes。</p><p>PPT 共 743 slides；class notes 共 495 pages。页数用于界定材料范围，不能单独证明解释完整。站点将两套材料的教学概念归并为十个单元；重复幻灯片、同一公式的逐行展开和同类例题不各自建立一页。本页下方提供分章节文件与主题定位；新增深入例题也标出具体课件/笔记页码。</p><p>课件的原始图、扫描表格和 textbook 页面未转载；本站的 SVG、图表和教学交互重新绘制。作业、测验、考试、个人提交答案以及姓名、成绩、账号等私人信息不在公开材料中。课程资料中的教学例子与原创例子在正文中区分。</p><h2>核查方法的 primary references</h2><p>以下官方文档可用于验证本站的方法与 software behavior：</p><ul><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/quantile.html">R stats: quantile — sample quantile conventions</a></li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/grDevices/html/boxplot.stats.html">R grDevices: boxplot.stats — hinges and whiskers</a></li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/t.test.html">R stats: t.test — Welch / pooled / paired</a></li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/wilcox.test.html">R stats: wilcox.test — rank-sum / signed-rank</a></li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/aov.html">R stats: aov — analysis of variance</a></li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/lm.html">R stats: lm — linear models</a></li><li><a href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/predict.lm.html">R stats: predict.lm — confidence / prediction intervals</a></li><li><a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda35a.htm">NIST: Levene and Brown–Forsythe tests</a></li></ul><h2>实验如何计算</h2><p>Normal CDF 用数值近似；Student’s t、F 与 χ² 的 CDF 使用 incomplete beta / gamma，quantile 由 bisection 求解。SVG 显示固定坐标轴范围内的数值；图中阴影对应 probability 或 interval，输出保留明确的假设。随机实验使用可复现的 pseudorandom generator，重复模拟得到的频率不必等于理论值。</p><p>置信区间实验和分步图解均需手动开始自动演示，可随时暂停；离开页面后停止。分步图解也可用上一步、下一步逐条阅读，减少动态模式下只保留手动推进。窄屏默认显示完整图解，也可展开“放大查看图解”移动查看细节；较宽的数据表可横向滚动，文字解释仍完整保留。所有核心解释与 worked examples 可在 JavaScript 关闭时阅读。图的颜色之外也使用形状、线型与数值来表达差异。</p><h2>如何学习</h2><ol><li>先写 population、parameter、experimental unit 和研究问题。</li><li>逐项检查 independence、normality、variance 与设计条件。</li><li>手算一个小例子，再改变实验中的一个参数，解释输出为何改变。</li><li>看练习答案之前先给出自己的结论，尤其区分 evidence、effect size 和 uncertainty。</li></ol><p>遇到软件或课程输出的差异，先检查 tail、df、quantile convention、missing values 和 model coding，不能只比最后一个 P-value。</p></main>'''
coverage=json.loads((root/'content/coverage.json').read_text())
coverage_html='<section id="coverage" class="lesson"><h2>按课程文件回查</h2><p>以下页码按文件中的 slide / PDF page 计数。正文新增的深入例题各附具体来源定位；这里列出教学主题与原始文件范围。题库题型参考作业与测验，题目及数值重新编写，不提供原卷或个人提交稿下载。</p>'
for entry in coverage:
 cid=entry['chapter']
 coverage_html+=f'<article class="coverage-item"><h3><a href="chapters/{cid}.html">Ch {"1–3" if cid=="01" else str(int(cid))} · {esc(entry["topic"])}</a></h3><ul>'
 for source in entry['sources']:
  coverage_html+='<li>'+esc(source['file'])+' · 页 '+esc(str(source['pages']))
  if source.get('topics'):coverage_html+='。'+'；'.join(esc(t['topic'])+'（'+esc(str(t['pages']))+'）' for t in source['topics'])
  coverage_html+='</li>'
 coverage_html+='</ul></article>'
coverage_html+='</section>'
about=about.replace('</main>',coverage_html+'</main>')
(root/'sources.html').write_text(doc('来源与使用',about))
(root/'404.html').write_text(doc('页面未找到','<main id="main" class="wrap about"><h1>页面未找到</h1><p>请从学习路径选择一个章节。</p><a href="index.html">返回首页 <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></a></main>'))
(root/'.nojekyll').touch()
print('Built',len(ch),'chapters and',len(search),'search sections')

from build_learning import build_learning
search.extend(build_learning(root,ch,doc,esc))
(root/'search.json').write_text(json.dumps(search,ensure_ascii=False))
