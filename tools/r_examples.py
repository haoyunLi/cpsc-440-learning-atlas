"""Generate a standalone download next to each authored chapter R example."""
import html
import re


def add_r_downloads(root, chapter, lesson, body):
    # These two lessons contain explicitly labelled SAS templates, not R.
    language = lesson.get('codeLanguage', 'sas' if (chapter, lesson['id']) in {
        ('09', 'sas'), ('15', 'random-effects')
    } else 'r')
    if language != 'r':
        return body
    count = 0

    def replace(match):
        nonlocal count
        count += 1
        name = f'chapter-{chapter}-{lesson["id"]}' + (f'-{count}' if count > 1 else '') + '.R'
        code = html.unescape(match.group(1)).strip()
        path = root / 'downloads' / 'chapters' / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            '# CPSC 440 Learning Atlas: standalone teaching example\n'
            f'# Chapter {chapter}, section: {lesson["id"]}\n'
            '# Run in a fresh R session; no external packages or data files are needed.\n'
            '# Read the lesson for assumptions, data provenance, and interpretation.\n\n'
            + code + '\n'
        )
        return (match.group(0) + '<p class="r-download">'
                f'<a href="../downloads/chapters/{name}" download>下载本节 R 示例'
                + (f' {count}' if count > 1 else '') + '</a>'
                ' · 已含数据和对象定义，可在新 R 会话中运行。'
                '<a href="../handbook.html#r-start">查看运行方法</a></p>')

    return re.sub(r'<pre><code>(.*?)</code></pre>', replace, body, flags=re.S)
