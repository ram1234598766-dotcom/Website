const fs = require('fs');
let code = fs.readFileSync('README.md', 'utf8');
console.log(code.substring(0, 100));
