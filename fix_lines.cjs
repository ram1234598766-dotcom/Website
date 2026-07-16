const fs = require('fs');
let lines = fs.readFileSync('src/components/CloudOS.tsx', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('const [showPlugins, setShowPlugins]'));
const endIdx = lines.findIndex(l => l.includes('}, [showPlugins, pluginSearch]);'));

if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
  lines.splice(startIdx, endIdx - startIdx + 1);
}
fs.writeFileSync('src/components/CloudOS.tsx', lines.join('\n'));
