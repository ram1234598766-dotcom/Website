const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Replace handleRun
const newHandleRun = `const handleRun = async () => {
    setIsTerminalOpen(true);
    const file = files.find(f => f.id === activeFileId);
    if (!file) return;
    
    try {
        // Save to real disk for execution
        await fetch('/api/fs/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content: file.content })
        });

        // Send to integrated terminal
        let cmd = '';
        if (file.language === 'javascript' || file.name.endsWith('.js')) {
            cmd = \`node "\${file.name}"\\n\`;
        } else if (file.language === 'typescript' || file.name.endsWith('.ts')) {
            cmd = \`npx tsx "\${file.name}"\\n\`;
        } else if (file.language === 'python' || file.name.endsWith('.py')) {
            cmd = \`python3 "\${file.name}"\\n\`;
        } else if (file.language === 'cpp' || file.name.endsWith('.cpp')) {
            cmd = \`g++ "\${file.name}" -o "\${file.name}.out" && ./"\${file.name}.out"\\n\`;
        } else if (file.language === 'c' || file.name.endsWith('.c')) {
            cmd = \`gcc "\${file.name}" -o "\${file.name}.out" && ./"\${file.name}.out"\\n\`;
        } else if (file.language === 'rust' || file.name.endsWith('.rs')) {
            cmd = \`rustc "\${file.name}" && ./"\${file.name.replace('.rs', '')}"\\n\`;
        } else if (file.language === 'go' || file.name.endsWith('.go')) {
            cmd = \`go run "\${file.name}"\\n\`;
        } else if (file.language === 'java' || file.name.endsWith('.java')) {
            cmd = \`javac "\${file.name}" && java "\${file.name.replace('.java', '')}"\\n\`;
        } else if (file.name.endsWith('.sh')) {
            cmd = \`bash "\${file.name}"\\n\`;
        } else {
            cmd = \`echo "File saved. Execute manually. Unrecognized language: \${file.language}"\\n\`;
        }
        window.dispatchEvent(new CustomEvent('terminal-send', { detail: cmd }));
    } catch (err) {
        console.error("Failed to run", err);
    }
  };`;

code = code.replace(/const handleRun = async \(\) => \{[\s\S]*?console\.error\("Failed to run", err\);\s*\}\s*\};/, newHandleRun);

// Add clear terminal button
// Look for the close panel button:
const closeBtnStr = `<button onClick={() => setIsTerminalOpen(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Close Panel">
                      <X className="w-3.5 h-3.5" />
                    </button>`;
const clearAndCloseBtns = `<button onClick={() => window.dispatchEvent(new CustomEvent('terminal-send', { detail: 'clear\\n' }))} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Clear Console">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setIsTerminalOpen(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Close Panel">
                      <X className="w-3.5 h-3.5" />
                    </button>`;

if (code.includes(closeBtnStr)) {
    code = code.replace(closeBtnStr, clearAndCloseBtns);
} else {
    // try slightly different spacing
    const closeBtnRegex = /<button onClick=\{\(\) => setIsTerminalOpen\(false\)\} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Close Panel">\s*<X className="w-3\.5 h-3\.5" \/>\s*<\/button>/m;
    code = code.replace(closeBtnRegex, clearAndCloseBtns);
}

fs.writeFileSync('src/components/CloudOS.tsx', code);
console.log('Patched CloudOS.tsx');
