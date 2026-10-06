---
name: CPSC 440 Atlas
description: A reading atlas for applied statistical methods.
colors:
  paper: "#f8f7f1"
  white: "#fff"
  ink: "#183a37"
  muted: "#50655f"
  accent: "#086f68"
  line: "#ccd6cf"
  wash: "#e8efea"
  alert: "#9a472e"
  action-hover: "#064d48"
  focus: "#b95c34"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans SC', 'PingFang SC', sans-serif"
    fontSize: "clamp(36px, 4.4vw, 68px)"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-.025em"
  chapter-display:
    fontSize: "clamp(32px, 4vw, 52px)"
    fontWeight: 600
    lineHeight: 1.35
  headline:
    fontSize: "clamp(26px, 3vw, 38px)"
    lineHeight: 1.35
  lesson-headline:
    fontSize: "30px"
    lineHeight: 1.35
  title:
    fontSize: "23px"
    lineHeight: 1.35
  identity:
    fontFamily: "AtlasSerif, Georgia, serif"
    fontSize: "25px"
    fontWeight: 600
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Noto Sans SC', 'PingFang SC', sans-serif"
    fontSize: "17px"
    lineHeight: 1.85
  label:
    fontSize: "14px"
  equation:
    fontFamily: "Georgia, 'Times New Roman', serif"
    fontSize: "18px"
    lineHeight: 2.1
  code:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "14px"
    lineHeight: 1.8
rounded:
  equation: "4px"
  control: "5px"
spacing:
  small: "15px"
  medium: "20px"
  paragraph: "22px"
  section: "65px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "9px 20px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.white}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "9px 20px"
  search-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "15px"
    width: "100%"
  reading-navigation:
    textColor: "{colors.accent}"
    typography: "{typography.label}"
  answer-disclosure:
    textColor: "{colors.ink}"
    padding: "20px 0"
  equation-panel:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    typography: "{typography.equation}"
    rounded: "{rounded.equation}"
    padding: "22px 25px"
  readout:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
    padding: "18px"
---

# Design System: CPSC 440 Atlas

## Overview

**Creative North Star: "The Statistical Reading Atlas"**

The site reads as an open paper field annotated in research-green ink. Broad sections, fine rules and generous reading intervals let explanations and mathematical figures share the page without dashboard framing.

Chinese explanations use the platform sans-serif stack. A locally supplied serif gives the English identity and chapter numbering their book-like character. Interaction changes statistical inputs and exposes their consequences; it does not add decorative movement.

**Key Characteristics:**

- Paper ground, green ink and pale green information surfaces.
- Ruled chapter navigation and continuous reading sections.
- Original SVG figures with labelled axes and visible numerical readouts.
- Serif English identity paired with Chinese sans-serif explanations.

## Colors

The palette places dark green text on a light paper ground, with a rust counterpoint for statistical comparisons and errors.

### Primary

- **Research Green** (`accent`): links, primary actions, diagram curves and points, and laboratory section rules.
- **Deep Action Green** (`action-hover`): filled-action hover state.

### Secondary

- **Comparison Rust** (`alert`): alternate plotted series, interval marks and validation errors.
- **Focus Rust** (`focus`): shared keyboard focus outline.

### Neutral

- **Paper** (`paper`): page and sticky header ground.
- **White** (`white`): plotting fields and editable controls.
- **Green Ink** (`ink`): body text, headings and active reading navigation.
- **Muted Ink** (`muted`): captions, source references and supporting text.
- **Fine Rule** (`line`): chapter divisions, table rows and control borders.
- **Green Wash** (`wash`): introductory field, equations, table headings and numerical readouts.

**The Redundant Encoding Rule.** Statistical comparisons pair color with labels, dash patterns or marker shapes.

## Typography

The frontmatter records the actual role sizes; it does not imply a uniform modular scale. The primary Chinese display and lesson headings use the body sans-serif stack. AtlasSerif, with Georgia fallback, is used for the English identity, English chapter subtitles and route numbers. Equations use Georgia and Times New Roman; code uses the platform monospace stack.

Large page headings establish hierarchy. Lesson titles settle to the repeated lesson-headline role, while smaller subheadings, labels and captions support long-form reading. Article width stops at approximately (75ch), and explanatory paragraphs stop at (72ch). Equations permit horizontal overflow when necessary.

Mobile body text changes to (16px) with line height (1.9). Home display text becomes (40px), lesson titles become (26px), and English hero subtitles become (21px). Chart labels increase in SVG coordinates to preserve their legibility when the figure shrinks.

**The Bilingual Hierarchy Rule.** Use serif type for the English identity and numbering; preserve the readable sans-serif treatment of Chinese explanations and display headings.

## Layout

The shared wrapper uses `min(1200px, 90vw)`. The home introduction has a two-column (1.1fr / 1fr) composition; the chapter page uses a (260px) reading-navigation column, a flexible article column and a (65px) gap. Navigation remains sticky beneath the header on wide screens.

At (950px) and below, the chapter sidebar becomes (200px) and its column gap becomes (30px). At (700px) and below, the hero and chapter layout become single columns. The sidebar becomes an explicit details disclosure, the header changes from (72px) to (64px), and section spacing tightens. Chapter route descriptions sit beneath their titles.

Laboratory controls use two equal columns; mobile select controls span both columns to accommodate long options. Figures fill their containing width. Tables and equations can scroll horizontally. The print layout removes navigation and laboratory controls while retaining the reading content.

## Elevation & Depth

There are no box shadows. Pale surfaces, white plotting fields and fine dividing rules create depth. The header's sticky position supplies reading continuity without a raised surface.

**The Flat Reading Field Rule.** Separate sections with space, rules and tonal fields rather than adding raised cards.

## Shapes

Containers and figures use straightforward rectangular geometry. Editable controls and buttons have modest rounding; equation and textarea surfaces use the smaller equation radius. Rules are generally (1px), and laboratory headings are introduced by a stronger accent rule (2px). SVG circles, squares, intervals and dashed lines encode mathematical roles. Navigation arrows are authored inline SVG paths.

## Components

### Buttons

Filled green controls use white text, the control radius, an accent border and a minimum height of (44px). Primary hover uses deep action green. Secondary buttons have transparent backgrounds and green text; the existing shared hover treatment fills them green. Disabled buttons reduce opacity to (.5). Keyboard focus uses a rust outline (3px) offset by (4px).

### Inputs / Fields

Search is a full-width white field with a fine border and the control radius. Laboratory number fields and selectors are white, bordered and at least (44px) tall; textarea fields use the smaller equation radius. Range controls use the research accent and an explicit text label. Mobile selectors occupy a complete row.

### Navigation

The sticky header pairs a serif identity with compact text links. Chapter navigation uses plain links; the current chapter is dark and bold. Route entries are entire linked rows with a serif number, title, description and authored arrow. Hover adds a green wash. Keyboard focus follows the common outline. A skip link appears on focus, and mobile reading navigation is a native disclosure.

### Equations and Readouts

Equations sit on pale green surfaces with serif notation and scrolling overflow. Numerical readouts use the same tonal material with tabular numerals and wrapped prose. They connect the plot to its calculation without introducing a separate card system.

### Statistical Laboratories

Each laboratory is part of the article flow: accent top rule, title, explanation, controls, SVG figure, numerical readout and caption. Plots use white grounds, labelled axes, green primary curves, rust comparisons and patterned alternatives. Readouts announce updates politely. Captions state what the figure represents and which assumptions apply.

### Disclosures and Tables

Answer disclosures use native details and summary elements with fine top rules and generous vertical space. Tables use washed header rows and fine row dividers. Neither pattern introduces shadows or ornamental framing.

## Do's and Don'ts

### Do:

- **Do** preserve the paper ground, dark green reading text and fine ruled sections.
- **Do** label statistical axes, inputs and comparisons and retain shape or dash distinctions.
- **Do** keep keyboard focus visible and maintain explicit mobile navigation.
- **Do** use interaction to expose a statistical mechanism and honour reduced-motion preferences.

### Don't:

- **Don't** convert continuous lesson content into a grid of raised dashboard cards.
- **Don't** communicate statistical comparisons through color alone.
- **Don't** shrink mobile selectors into narrow columns when their options need a complete row.
- **Don't** replace authored SVG navigation arrows with text glyph icons.
