const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.resolve(__dirname, '../../../unofficial-homestuck-collection/resources/app.asar');
const asar = fs.readFileSync(file);
const header = JSON.parse(asar.subarray(16, 16 + asar.readUInt32LE(12)).toString());
const base = 8 + asar.readUInt32LE(4);

function sourceWith(needle) {
  for (const [name, entry] of Object.entries(header.files.js.files)) {
    if (entry.size > 2000000 || name.includes('vendor')) continue;
    const start = base + Number(entry.offset);
    const raw = asar.subarray(start, start + entry.size).toString();
    if (!raw.includes(needle)) continue;
    const matches = raw.matchAll(/eval\((["'])/g);
    for (const match of matches) {
      const quote = match[1];
      const first = match.index + 5;
      let end = first + 1;
      while (end < raw.length) {
        if (raw[end] === '\\') { end += 2; continue; }
        if (raw[end] === quote) break;
        end++;
      }
      const decoded = vm.runInNewContext(raw.slice(first, end + 1));
      if (decoded.includes(needle)) return decoded.split('//# sourceMappingURL=')[0];
    }
  }
  throw new Error('UHC source not found: ' + needle);
}

function component(variable, context) {
  const source = sourceWith('var ' + variable + ' = (');
  const start = source.indexOf('var ' + variable + ' = (') + ('var ' + variable + ' = ').length;
  const end = source.indexOf('\n});', start) + 4;
  const definition = vm.runInNewContext(source.slice(start, end), context);
  const renderStart = source.indexOf('var render = ') + 'var render = '.length;
  const renderEnd = source.indexOf('\nvar staticRenderFns', renderStart);
  definition.render = vm.runInNewContext('(' + source.slice(renderStart, renderEnd) + ')', context);
  definition.staticRenderFns = [];
  definition._compiled = true;
  return definition;
}

module.exports = { sourceWith, component };
