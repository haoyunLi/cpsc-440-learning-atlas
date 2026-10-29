"""Build one original case from a shared, fixed teaching dataset."""
import csv
import io
import json
import re


def case_r(csv_text):
    return '''# Original teaching case: 12 pots, three plants per pot.
# These values are constructed, not a simulated random sample.
# Treatment was assigned to pots; plants within a pot are subsamples.
# The prespecified response is the mean height of the three plants per pot.
raw <- read.csv(text = "''' + csv_text.rstrip() + '''", stringsAsFactors = FALSE)

# Audit identities and completeness before aggregating.
stopifnot(nrow(raw) == 36L, !anyNA(raw),
          all(is.finite(raw$height_cm)),
          !anyDuplicated(raw[c("pot", "plant")]),
          all(table(raw$pot) == 3L),
          all(tapply(raw$treatment, raw$pot,
                     function(x) length(unique(x))) == 1L))
pot <- aggregate(height_cm ~ pot + treatment, data = raw, FUN = mean)
stopifnot(nrow(pot) == 12L, !anyDuplicated(pot$pot),
          all(table(pot$treatment) == 6L))
print(raw)
print(pot)

# Six independent pot responses per group, not eighteen plant responses.
a <- pot$height_cm[pot$treatment == "A"]
b <- pot$height_cm[pot$treatment == "B"]
group_summary <- data.frame(
  treatment = c("A", "B"), n = c(length(a), length(b)),
  mean_cm = c(mean(a), mean(b)), variance_cm2 = c(var(a), var(b)),
  sd_cm = c(sd(a), sd(b))
)
print(group_summary)

# Inspect the pot-level response distributions and residuals.
# With only six pots per group, plots cannot establish Normality.
# Independence and randomization must be checked against the study protocol.
par(mfrow = c(2, 2))
stripchart(height_cm ~ treatment, data = pot, vertical = TRUE,
           method = "stack", pch = 16, ylab = "Pot mean height (cm)")
qqnorm(a, main = "Group A: pot means"); qqline(a)
qqnorm(b, main = "Group B: pot means"); qqline(b)
fitted_means <- ave(pot$height_cm, pot$treatment, FUN = mean)
plot(fitted_means, pot$height_cm - fitted_means,
     xlab = "Fitted group mean (cm)", ylab = "Pot residual (cm)")
abline(h = 0, lty = 2)
par(mfrow = c(1, 1))

# Prespecified two-sided comparison B minus A, alpha = 0.05.
# Welch inference is conditional on a suitable independent pot-level model.
# Similar observed variances do not prove equal population variances.
fit <- t.test(b, a, alternative = "two.sided", var.equal = FALSE,
              conf.level = 0.95)
print(fit)

# Reproduce the same calculation explicitly.
estimate <- mean(b) - mean(a)
vb <- var(b) / length(b)
va <- var(a) / length(a)
se <- sqrt(vb + va)
df <- (vb + va)^2 / (vb^2 / (length(b) - 1) +
                      va^2 / (length(a) - 1))
statistic <- estimate / se
p_value <- 2 * pt(-abs(statistic), df)
ci <- estimate + c(-1, 1) * qt(0.975, df) * se
print(c(estimate = estimate, se = se, df = df, t = statistic,
        p = p_value, lower = ci[1], upper = ci[2]))
stopifnot(abs(se - fit$stderr) < 1e-10,
          abs(p_value - fit$p.value) < 1e-10,
          max(abs(ci - fit$conf.int)) < 1e-8)

# Deliberately INVALID comparison: treating plants as independent replicates.
# This calculation illustrates pseudoreplication; it is not inferential evidence.
wrong <- t.test(raw$height_cm[raw$treatment == "B"],
                raw$height_cm[raw$treatment == "A"])
print(data.frame(
  analysis = c("Pot-level model", "INVALID independent-plant model"),
  n_per_group = c(length(a), sum(raw$treatment == "A")),
  estimate = c(estimate, unname(wrong$estimate[1] - wrong$estimate[2])),
  se = c(fit$stderr, wrong$stderr),
  df = c(unname(fit$parameter), unname(wrong$parameter)),
  p = c(fit$p.value, wrong$p.value),
  lower = c(fit$conf.int[1], wrong$conf.int[1]),
  upper = c(fit$conf.int[2], wrong$conf.int[2])
))

# P > 0.05 is insufficient evidence of a difference, not proof of equivalence.
# Random treatment assignment does not supply random population sampling.
# The interval relies on the pot-level model, not an exact randomization test.
sessionInfo()
'''


def build_case(root, doc, esc):
    data = json.loads((root / 'content/study-case.json').read_text())
    pots, questions = data['pots'], data['questions']
    steps = [('design', '研究设计'), ('data', '整理数据'), ('method', '选定方法'),
             ('checks', '核对条件'), ('results', '计算与输出'), ('report', '写出结论')]
    assert len(pots) == len({p['id'] for p in pots}) == 12
    assert all(len(p['values']) == 3 for p in pots)
    assert set(questions) == {key for key, _ in steps}
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator='\n')
    writer.writerow(['pot', 'treatment', 'plant', 'height_cm'])
    for p in pots:
        for i, value in enumerate(p['values'], 1):
            writer.writerow([p['id'], p['treatment'], 'S' + str(i), value])
    csv_text = buffer.getvalue()
    (root / 'downloads/study-case.csv').write_text(csv_text)
    rcode = case_r(csv_text)
    (root / 'downloads/study-case.R').write_text(rcode)
    rows = ''.join(f'<tr data-pot-id="{esc(p["id"])}"><th scope="row"><button type="button" data-case-select value="{esc(p["id"])}" disabled>{esc(p["id"])}</button></th><td>{esc(p["treatment"])}</td>'
                   + ''.join(f'<td>{v:g}</td>' for v in p['values'])
                   + f'<td>{sum(p["values"])/3:g}</td></tr>' for p in pots)
    table = f'''<p class="status">原始数据为本站构造的教学数据；盆编号不表示位置，也不是配对编号。每行列出同一盆的三株；CSV 中每株占一行。选择盆编号，追踪其三株如何形成一个分析值。</p>
<div data-case-visual></div><p data-case-selected role="status" aria-live="polite">P01：三株 11、12、13 cm → 盆均值 (11+12+13)/3 = 12 cm。</p>
<table><caption>12 盆的全部 36 个原始值与分析响应（cm）</caption><thead><tr><th scope="col">盆 ID</th><th scope="col">处理</th><th scope="col">株 S1</th><th scope="col">株 S2</th><th scope="col">株 S3</th><th scope="col">盆均值</th></tr></thead><tbody>{rows}</tbody></table>
<p><a href="downloads/study-case.csv" download>下载 36 行原始 CSV</a> · <a href="downloads/study-case.R" download>下载完整 R 脚本</a></p>'''
    body = (root / 'content/study-case.html').read_text()
    body = body.replace('<div data-case-explorer></div>', '<div data-case-explorer>' + table + '</div>')
    for key, label in steps:
        q = questions[key]
        assert q['answer'] in {o['value'] for o in q['options']}
        assert set(q['feedback']) == {o['value'] for o in q['options']}
        options = ''.join(f'<label class="answer-option"><input type="radio" name="answer" value="{esc(o["value"])}" disabled><span>{esc(o["label"])}</span></label>' for o in q['options'])
        form = f'''<div class="case-checkpoint"><form data-case-question="{key}"><fieldset><legend>{esc(q['prompt'])}</legend>{options}</fieldset><button type="submit" disabled>检查这一步</button><p data-case-feedback role="status" aria-live="polite"></p></form><details><summary>核对这一步的解释</summary><p>{esc(q['explanation'])}</p></details></div>'''
        body = body.replace(f'<div data-case-question-slot="{key}"></div>', form)
    body = body.replace('<!-- CASE_R -->', f'<details id="case-r"><summary>展开完整 R：从 36 行到最终报告数值</summary><p>整段复制到 R；无需额外 packages。浏览器不会执行 R。脚本内置同一份 CSV 文本，不依赖工作目录。<a href="downloads/study-case.R" download>下载 .R 脚本</a></p><pre><code>{esc(rcode)}</code></pre></details>')
    nav = ''.join(f'<a href="#case-{key}">{i:02d} · {label}</a>' for i, (key, label) in enumerate(steps, 1))
    page = f'''<main id="main" class="wrap study-page handbook" data-study-case><div class="study-heading"><p class="status">原创贯穿案例 · Ch 1–3 / Ch 5 / Ch 6 / Ch 8 / Ch 15</p><h1>36 行数据，究竟有多少个独立重复？</h1><p class="study-lead">从一项温室试验出发，亲手走完设计、整理、推断与结论。每一步都沿用同一份数据。</p><p>建议先学<a href="chapters/01.html#variables">实验单位</a>与<a href="chapters/06.html#welch">两独立样本 Welch</a>；不熟悉 R 时可先看<a href="handbook.html#r-start">R 入门</a>。</p></div><nav class="study-jumps" aria-label="案例六步">{nav}</nav><div class="case-learning-status"><p data-case-progress role="status">六处自检可在启用 JavaScript 后检查；所有解释、数据和 R 始终可读。</p><p class="status">自检只记录本页当前状态，刷新即重新开始；不计入练习工坊的累计记录。</p><button type="button" class="secondary" data-case-reset disabled>重新做六步自检</button></div>{body}<script type="application/json" id="study-case-data">{json.dumps(data, ensure_ascii=False).replace('<', chr(92) + 'u003c')}</script></main>'''
    page = re.sub(r'(<table\b.*?</table>)', r'<div class="table-scroll" tabindex="0" role="region" aria-label="案例数据表，可横向滚动">\1</div>', page, flags=re.S)
    (root / 'case-study.html').write_text(doc('从实验单位到完整分析', page))
    return [{'chapter': '贯穿案例', 'title': label, 'text': '贯穿案例 实验单位 experimental unit subsample 伪重复 pseudoreplication Welch CSV R ' + questions[key]['prompt'], 'url': 'case-study.html#case-' + key} for key, label in steps]
