const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/      <div className="min-h-14 py-2 h-auto bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between px-4 select-none shrink-0 z-20 relative gap-3">\n\s*<div className="flex items-center gap-3">/,
`      <div className="min-h-14 py-2 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between px-4 select-none shrink-0 z-20 relative gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">`
);

code = code.replace(
/        <div className="flex flex-wrap items-center gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto flex-1 justify-end">/,
`        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto sm:justify-end flex-nowrap shrink-0">`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
