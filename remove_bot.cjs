const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/import GlobalHelperBot from '\.\/components\/GlobalHelperBot';\n/, '');
code = code.replace(/<GlobalHelperBot \/>\n\s*/, '');

fs.writeFileSync('src/App.tsx', code);
