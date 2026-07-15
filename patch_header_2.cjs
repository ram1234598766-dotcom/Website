const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/<button \n\s*onClick=\{\(\) => setIsSearchOpen\(!isSearchOpen\)\}/,
`<button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}`
);

code = code.replace(
/className="flex items-center gap-2 px-3 py-1\.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800\/50 text-slate-400 border-slate-700\/50 hover:bg-slate-800 hover:text-slate-300"/g,
`className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"`
);

code = code.replace(
/className="flex items-center gap-2 px-3 py-1\.5 bg-indigo-600\/20 text-indigo-400 hover:bg-indigo-600\/30 hover:text-indigo-300 rounded-lg text-sm font-medium transition-colors border border-indigo-500\/20"/,
`className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 rounded-lg text-sm font-medium transition-colors border border-indigo-500/20"`
);

code = code.replace(
/className="flex items-center gap-2 px-3 py-1\.5 bg-emerald-600\/20 text-emerald-400 hover:bg-emerald-600\/30 hover:text-emerald-300 rounded-lg text-sm font-medium transition-colors border border-emerald-500\/20 disabled:opacity-50"/,
`className="flex whitespace-nowrap items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300 rounded-lg text-sm font-medium transition-colors border border-emerald-500/20 disabled:opacity-50"`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
