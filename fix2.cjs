const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const regex = /<\/motion\.div>\s*\}\)\s*className=/;
console.log(regex.test(code));
