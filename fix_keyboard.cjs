const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(/\} else if \(\(e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === 'p' \|\| e\.key === 'P'\)\) \{\n\s*e\.preventDefault\(\);\n\s*setShowPlugins\(prev => !prev\);\n\s*\} else if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === '\/'\) \{\n\s*e\.preventDefault\(\);\n\s*setShowShortcuts\(prev => !prev\);/g, '');

code = code.replace(/plugins\['prettier'\]\?\.active/g, 'true');

code = code.replace(/\{plugins\['gitlens'\]\?\.active && \(/g, '{true && (');

fs.writeFileSync('src/components/CloudOS.tsx', code);
