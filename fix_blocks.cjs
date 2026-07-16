const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Find Plugin Store
let idx1 = code.indexOf('{/* Plugin Store */}');
if (idx1 !== -1) {
  let endIdx1 = code.indexOf('</AnimatePresence>', idx1);
  if (endIdx1 !== -1) {
    code = code.slice(0, idx1) + code.slice(endIdx1 + '</AnimatePresence>'.length);
  }
}

// Find Keyboard Shortcuts
let idx2 = code.indexOf('{/* Keyboard Shortcuts */}');
if (idx2 !== -1) {
  let endIdx2 = code.indexOf('</AnimatePresence>', idx2);
  if (endIdx2 !== -1) {
    code = code.slice(0, idx2) + code.slice(endIdx2 + '</AnimatePresence>'.length);
  }
}

fs.writeFileSync('src/components/CloudOS.tsx', code);
