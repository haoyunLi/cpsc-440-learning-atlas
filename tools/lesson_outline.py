"""Build static outlines from authored lesson headings without rewriting HTML.

Call enrich_lesson before adding R downloads, diagrams, practice links, or other
generated reading tools. Pre-register all chapter IDs in a fresh mutable set;
the function preserves explicit IDs and adds its generated IDs to that set.
collect_ids returns every actual element ID so the caller can reject duplicate
explicit IDs across lessons before enrichment.
"""

from collections import Counter
from dataclasses import dataclass, field
from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import re
from urllib.parse import quote


_HEADING_SKIP = frozenset({"pre", "code", "script", "style", "nav", "figure", "details", "template"})
_TEXT_SKIP = frozenset({"pre", "script", "style", "nav", "template"})
_VOID = frozenset({"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"})
_BLOCK = frozenset({"address", "article", "aside", "blockquote", "br", "caption", "dd", "div", "dl", "dt", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "ol", "p", "section", "table", "tbody", "td", "th", "thead", "tr", "ul"})


def _normalized(text):
    return " ".join(text.split())


@dataclass
class _Heading:
    level: int
    start: int
    tag_end: int
    explicit_id: str | None
    parts: list = field(default_factory=list)
    end: int | None = None
    title: str = ""
    text: str = ""
    parent_title: str = ""


class _LessonParser(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.line_starts = [0] + [match.end() for match in re.finditer("\n", source)]
        self.frames = []
        self.headings = []
        self.active = None
        self.chunks = []
        self.ids = []
        self.feed(source)
        self.close()
        if self.active is not None:
            raise ValueError("An authored h3/h4 heading has no closing tag")

    def source_offset(self):
        line, column = self.getpos()
        return self.line_starts[line - 1] + column

    def blocked(self, key):
        return bool(self.frames and self.frames[-1][key])

    def separator(self, tag, position):
        if tag in _BLOCK and not self.blocked("text"):
            self.chunks.append((position, " "))
        if tag == "br" and self.active is not None:
            self.active.parts.append(" ")

    def handle_starttag(self, tag, attrs):
        position = self.source_offset()
        raw_tag = self.get_starttag_text()
        id_attributes = [value for name, value in attrs if name == "id"]
        if len(id_attributes) > 1:
            raise ValueError("An element has multiple id attributes")
        explicit_id = id_attributes[0] if id_attributes else None
        if id_attributes:
            if not explicit_id:
                raise ValueError("An explicit element ID must not be empty")
            self.ids.append(explicit_id)
        attributes = dict(attrs)
        source_locator = "source-locator" in (attributes.get("class") or "").split()
        heading_blocked = self.blocked("heading") or tag in _HEADING_SKIP or source_locator
        text_blocked = self.blocked("text") or tag in _TEXT_SKIP or source_locator
        self.separator(tag, position)
        authored_heading = None
        if tag in {"h3", "h4"} and not heading_blocked:
            if self.active is not None:
                raise ValueError("Authored h3/h4 headings must not be nested")
            self.active = _Heading(int(tag[1]), position, position + len(raw_tag), explicit_id)
            self.headings.append(self.active)
            authored_heading = self.active
        if tag not in _VOID:
            self.frames.append({"tag": tag, "heading": heading_blocked, "text": text_blocked, "authored": authored_heading})

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in _VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        position = self.source_offset()
        for index in range(len(self.frames) - 1, -1, -1):
            if self.frames[index]["tag"] == tag:
                if self.active is not None and self.frames[index]["authored"] is self.active:
                    self.active.end = self.source.find(">", position) + 1
                    self.active.title = _normalized("".join(self.active.parts))
                    self.active = None
                del self.frames[index:]
                break
        self.separator(tag, position)

    def handle_data(self, data):
        if not self.blocked("text"):
            self.chunks.append((self.source_offset(), data))
        if self.active is not None and not self.blocked("text"):
            self.active.parts.append(data)

    def text_between(self, start, end):
        return _normalized("".join(text for position, text in self.chunks if start <= position < end))


def collect_ids(body):
    """Return IDs in source order, including IDs on non-outline elements.

    The list intentionally retains duplicates for a chapter-level Counter check.
    Escaped code strings are text, and script/style contents are not parsed into
    elements. No source HTML is serialized or modified.
    """
    return _LessonParser(body).ids


def enrich_lesson(body, lesson_id, reserved_ids=None):
    """Return (HTML, entries) for visible authored h3/h4 headings.

    Each entry has level (3/4), id, title and decoded plain text. Its text starts
    after the heading and stops at the next eligible heading of equal or higher
    level. Code blocks, scripts, navigation and source locators are excluded.

    reserved_ids may already contain this body's explicit IDs. A fresh chapter
    registry should be used for each build; generated IDs are added in place.
    Distinct duplicate titles use section-content hashes, so reordering them
    does not renumber their anchors. Indistinguishable repeated blocks or
    exhausted full-hash collisions use a final deterministic suffix.
    """
    if not isinstance(body, str) or not isinstance(lesson_id, str) or not lesson_id.strip():
        raise ValueError("Lesson HTML and a nonempty lesson ID are required")
    if reserved_ids is not None and not isinstance(reserved_ids, set):
        raise TypeError("reserved_ids must be a mutable set of chapter IDs")
    parser = _LessonParser(body)
    duplicates = [identifier for identifier, count in Counter(parser.ids).items() if count > 1]
    if duplicates:
        raise ValueError("Duplicate authored element IDs: " + ", ".join(duplicates))
    headings = [heading for heading in parser.headings if heading.title]
    parent = ""
    for index, heading in enumerate(headings):
        end = next((following.start for following in headings[index + 1:] if following.level <= heading.level), len(body))
        heading.text = parser.text_between(heading.end, end)
        if heading.level == 3:
            parent = heading.title
        else:
            heading.parent_title = parent
    prefix = re.sub(r"[^A-Za-z0-9_-]+", "-", lesson_id).strip("-")
    if not prefix:
        prefix = "lesson-" + sha256(lesson_id.encode()).hexdigest()[:12]
    def base_id(heading):
        digest = sha256(f"{lesson_id}\0{heading.level}\0{heading.title}".encode()).hexdigest()[:12]
        return f"sub-{prefix}-{digest}"
    bases = Counter(base_id(heading) for heading in headings if heading.explicit_id is None)
    occupied = set(reserved_ids or ()) | set(parser.ids) | {lesson_id}
    entries = []
    insertions = []
    for heading in headings:
        identifier = heading.explicit_id
        if identifier is None:
            base = base_id(heading)
            identifier = base
            if bases[base] > 1 or identifier in occupied:
                context = f"{heading.parent_title}\0{heading.title}\0{heading.text}"
                digest = sha256(context.encode()).hexdigest()
                for length in (12, 20, 32, 64):
                    identifier = f"{base}-{digest[:length]}"
                    if identifier not in occupied:
                        break
                else:
                    suffix = 2
                    while f"{identifier}-{suffix}" in occupied:
                        suffix += 1
                    identifier = f"{identifier}-{suffix}"
            occupied.add(identifier)
            # Insert before the original closing bracket, preserving every byte
            # of authored attributes, whitespace, entities and heading content.
            insertion = heading.tag_end - 1
            if body[insertion - 1:insertion] == "/":
                insertion -= 1
            insertions.append((insertion, f' id="{escape(identifier, quote=True)}"'))
        entries.append({"level": heading.level, "id": identifier, "title": heading.title, "text": heading.text})
    enriched = body
    for position, value in reversed(insertions):
        enriched = enriched[:position] + value + enriched[position:]
    if reserved_ids is not None:
        reserved_ids.update(occupied)
    return enriched, entries


def render_outline(entries, lesson_title):
    """Render a closed, script-free details/nav with nested h3/h4 links."""
    if not entries:
        return ""
    tree = []
    parent = None
    for entry in entries:
        if entry["level"] not in (3, 4):
            raise ValueError("Outline entries must have level 3 or 4")
        node = {"entry": entry, "children": []}
        if entry["level"] == 4 and parent is not None:
            parent["children"].append(node)
        else:
            tree.append(node)
        if entry["level"] == 3:
            parent = node
    def render_nodes(nodes):
        return "<ol>" + "".join(
            '<li><a href="#' + escape(quote(node["entry"]["id"], safe="-._~"), quote=True) + '">'
            + escape(node["entry"]["title"]) + "</a>"
            + (render_nodes(node["children"]) if node["children"] else "") + "</li>"
            for node in nodes
        ) + "</ol>"
    return '<details class="lesson-outline"><summary>本节导读 · ' + str(len(entries)) + ' 个主题</summary><nav aria-label="' + escape(str(lesson_title) + "的小节导读", quote=True) + '">' + render_nodes(tree) + "</nav></details>"
