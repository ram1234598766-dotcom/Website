const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/<button \n\s*id="run-code-button"/,
`{plugins['gitlens']?.active && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className={\`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border \${showDiff ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300'}\`}
            >
              <Code2 className="w-4 h-4" />
              <span className="hidden sm:inline">Diff</span>
            </button>
          )}
          
          <button
            onClick={handleFormat}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-slate-300"
          >
            <Code2 className="w-4 h-4" />
            <span className="hidden sm:inline">Format</span>
          </button>
          <button 
            id="run-code-button"`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
