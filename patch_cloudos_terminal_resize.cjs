const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Add state for terminal height
if (!code.includes('terminalHeight')) {
    code = code.replace(/const \[isTerminalOpen, setIsTerminalOpen\] = useState\(true\);/, `const [isTerminalOpen, setIsTerminalOpen] = useState(true);\n  const [terminalHeight, setTerminalHeight] = useState(256);\n  const [isResizingTerminal, setIsResizingTerminal] = useState(false);`);
}

// Update the terminal panel div
code = code.replace(/\{isTerminalOpen && \(\s*<div className="h-64 bg-\[#1e1e1e\] border-t border-slate-800 flex flex-col shrink-0">/, `{isTerminalOpen && (
              <div style={{ height: terminalHeight }} className="bg-[#1e1e1e] border-t border-slate-800 flex flex-col shrink-0 relative">
                {/* Resizer */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-indigo-500/50 z-10"
                  onMouseDown={() => setIsResizingTerminal(true)}
                />`);

// Add mouse handlers to document
code = code.replace(/useEffect\(\(\) => \{\s*if \(terminalRef\.current\)/, `useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingTerminal) return;
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 100 && newHeight < window.innerHeight - 200) {
        setTerminalHeight(newHeight);
      }
    };
    const handleMouseUp = () => setIsResizingTerminal(false);
    if (isResizingTerminal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTerminal]);

  useEffect(() => {
    if (terminalRef.current)`);

fs.writeFileSync('src/components/CloudOS.tsx', code);
