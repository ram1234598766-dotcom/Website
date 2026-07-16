const fs = require('fs');
let code = fs.readFileSync('src/lib/github.ts', 'utf8');
code = code.replace("content: unescape(encodeURIComponent(content)),", "content: btoa(unescape(encodeURIComponent(content))),");
fs.writeFileSync('src/lib/github.ts', code);
