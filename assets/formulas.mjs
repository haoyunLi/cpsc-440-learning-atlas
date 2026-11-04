import katex from './vendor/katex/katex.mjs';

// Kept as a small API for figures whose numbers change after page load.
export function equationHTML(tex, display = true) {
  return katex.renderToString(tex, { displayMode: display, output: 'htmlAndMathml', throwOnError: true, strict: 'error', trust: false });
}
