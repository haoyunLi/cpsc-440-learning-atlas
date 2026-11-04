const fs = require('node:fs');
const katex = require('../assets/vendor/katex/katex.min.js');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(input.map(({tex, display = true}) => katex.renderToString(tex, {
  displayMode: display, output: 'htmlAndMathml', throwOnError: true,
  strict: 'error', trust: false, maxExpand: 1000
}))));
