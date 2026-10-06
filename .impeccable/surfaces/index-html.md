---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["chapters/01.html","chapters/04.html","chapters/05.html","chapters/06.html","chapters/07.html","chapters/08.html","chapters/09.html","chapters/11.html","chapters/14.html","chapters/15.html","sources.html"]
---

# Statistical learning atlas

Scope and visitor mode: Read. The home page introduces the route; chapter pages carry sustained explanation, worked examples, static mathematical diagrams, step walkthroughs and parameter-driven statistical figures. This revision extends the existing paper-and-green reading atlas.

Audience and job: Chinese-speaking students reviewing applied statistical methods while retaining English technical terms. Begin with observations, select a chapter, or search for a concept; then follow natural Chinese explanations from the question through each calculation to its interpretation. Use step controls to unpack a diagram and laboratory controls to examine how changing an input changes the result.

Proof and content: The first viewport shows observations becoming a sampling distribution and an interval estimate. Ten ruled route entries lead to the implemented chapters. The chapter source contains 78 teaching sections, 20 static mathematical SVG figures and 10 walkthroughs with four frames each, alongside the 10 existing laboratories. Walkthrough explanations and equations follow the plotted changes; laboratories connect adjustable inputs, labelled SVG diagrams, numerical readouts and assumptions. These counts describe the implementation and do not certify source coverage.

Direction and memorable moment: An open statistical reading atlas. The observation-to-inference illustration establishes the subject immediately. Step diagrams expose how a calculation is built, such as fixing a rejection threshold before interpreting α, β and power, or turning regression residuals into SSE and MSE. Parameter controls then let the reader change an explicit model quantity and see its consequences.

Constraints: Keep explanations readable on a single mobile column, preserving English technical terms and the established identity. Preserve keyboard focus, labels plus line patterns and numerical annotations, native disclosure navigation, full-width mobile selectors, and reduced-motion behavior. Show the complete teaching diagram at mobile article width; the optional “放大查看图解” disclosure contains a keyboard-focusable 680px view that follows the current step. Wider tables scroll within labelled local regions. Manual previous, next and reset controls remain available; requested automatic demonstration advances every 4.2 seconds and stops at the last step, offscreen, on document hiding or on page exit. Reduced motion disables automatic demonstration. Static final diagrams and every step's explanation and equation remain in HTML when JavaScript or walkthrough loading fails. Public content consists of authored teaching material and verified public references. Browser-local completion marks are optional reading aids.

Unresolved decisions: No open visual decisions in the documented implementation. Future chapters should be checked against the implemented reading and laboratory patterns rather than assumed complete by this brief.
