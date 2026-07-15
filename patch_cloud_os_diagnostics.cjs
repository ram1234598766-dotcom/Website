const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

if (!code.includes('showDiagnostics')) {
  code = code.replace(
    /  const \[compileProgress, setCompileProgress\] = useState\(0\);/,
    `  const [compileProgress, setCompileProgress] = useState(0);\n  const [showDiagnostics, setShowDiagnostics] = useState(false);`
  );
}

code = code.replace(
/      \} else if \(\(e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === '\/'\)\) \{/,
`      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setShowDiagnostics(prev => !prev);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '/')) {`
);

const diagPanel = `
      {/* Developer Diagnostics View (Hidden) */}
      <AnimatePresence>
        {showDiagnostics && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 right-4 w-80 bg-slate-900 border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden z-[100] font-mono"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-3 h-3" /> Diagnostics
              </div>
              <button onClick={() => setShowDiagnostics(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-3 space-y-3 text-xs text-slate-300">
              <div>
                <div className="text-slate-500 mb-1">Heap Memory</div>
                <div className="flex justify-between items-center">
                  <span>{(performance as any)?.memory?.usedJSHeapSize ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + ' MB' : '42 MB'}</span>
                  <span className="text-emerald-400">Stable</span>
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Loaded Plugins Bundle Size</div>
                {Object.entries(plugins).filter(([k, p]) => p.active).length > 0 ? (
                  Object.entries(plugins).filter(([k, p]) => p.active).map(([key, p]) => (
                    <div key={key} className="flex justify-between items-center mt-1">
                      <span>{p.name}</span>
                      <span className="text-indigo-400">{Math.round(Math.random() * 400 + 50)} KB</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">No plugins active</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
`;

code = code.replace(
/      \{\/\* Plugins Modal \*\/\}/,
      diagPanel + '\n      {/* Plugins Modal */}'
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
