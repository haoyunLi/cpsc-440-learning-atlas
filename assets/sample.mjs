// Shared, DOM-free parsing for the chapter summary and two-sample workbenches.
export function parseSample(raw, { maxAbs = 1e6 } = {}) {
  const input = typeof raw === 'string' ? raw.trim() : '';
  if (/^[,，;；]|[,，;；]$|[,，;；]\s*[,，;；]/.test(input)) throw Error('数据中存在空字段；请检查开头、末尾或连续分隔符。空值不能自动替换成 0。');
  const tokens = input.split(/[\s,，;；]+/);
  const values = tokens.map(Number);
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  if (!input || values.length < 2 || values.length > 500 || tokens.some(t => !decimal.test(t)) || values.some(x => !Number.isFinite(x) || Math.abs(x) > maxAbs)) throw Error(`请输入 2–500 个有限数字（绝对值 ≤ ${maxAbs.toExponential(0)}），以逗号或空格分隔。`);
  return values;
}
