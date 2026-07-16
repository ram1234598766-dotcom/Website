const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const keydownOld = `    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('run-code-button')?.click();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {`;

const keydownNew = `    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setShowPlugins(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {`;

code = code.replace(keydownOld, keydownNew);

const uiOld = `                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Run Code</span>
                  <span className="font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">Ctrl + Enter</span>
                </div>`;
code = code.replace(uiOld, '');

fs.writeFileSync('src/components/CloudOS.tsx', code);
