const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/<div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto sm:justify-end flex-nowrap shrink-0">/,
`<div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto sm:justify-end shrink-0 py-1">`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
