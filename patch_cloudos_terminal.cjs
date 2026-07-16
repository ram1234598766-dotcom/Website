const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Add import
if (!code.includes('import TerminalPanel')) {
    code = code.replace(/import \{ Keyboard, GitMerge, Github \} from 'lucide-react';/, `import { Keyboard, GitMerge, Github } from 'lucide-react';\nimport TerminalPanel from './TerminalPanel';`);
}

// Replace the VS Code terminal body
const startStr = `<div \n                  ref={terminalRef}\n                  className="flex-1 p-4 font-mono text-sm text-slate-300 overflow-y-auto whitespace-pre-wrap select-text"\n                >\n                  {terminalOutput}\n                </div>`;
const replacementStr = `<div className="flex-1 overflow-hidden relative">\n                  <TerminalPanel />\n                </div>`;
code = code.replace(startStr, replacementStr);

// Also remove the "clear terminal" button because it won't clear the xterm from outside easily (unless we add a ref)
const clearBtn = `<button onClick={() => setTerminalOutput('VantaOS Terminal\\n$ ')} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Clear Terminal">\n                      <Trash2 className="w-3.5 h-3.5" />\n                    </button>`;
code = code.replace(clearBtn, '');

fs.writeFileSync('src/components/CloudOS.tsx', code);
