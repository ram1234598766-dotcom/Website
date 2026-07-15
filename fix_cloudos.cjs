const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// 1. Remove first handleFormat
const lines = code.split('\n');
const start = 543; // 544 is index 543
const end = 579;   // 579 is index 578
lines.splice(start, end - start + 1);
code = lines.join('\n');

// 2. Fix the missing )}
code = code.replace(
/                      \}\n\s*\/>\n\s*<\/div>/,
`                      }
                    />
                  )}
                  </div>`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
