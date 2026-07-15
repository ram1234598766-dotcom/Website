const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

if (!code.includes('Keyboard Shortcuts Modal')) {
  code = code.replace(/<div className="flex-1 flex flex-col min-w-0">/, `
        {/* Keyboard Shortcuts Modal */}
        <AnimatePresence>
          {showShortcuts && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowShortcuts(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full"
              >
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-indigo-400" />
                    Keyboard Shortcuts
                  </h3>
                  <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                    <span className="text-slate-300 text-sm">Run Code</span>
                    <kbd className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600 font-mono">Ctrl/⌘ + Enter</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                    <span className="text-slate-300 text-sm">Save & Format</span>
                    <kbd className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600 font-mono">Ctrl/⌘ + S</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                    <span className="text-slate-300 text-sm">Global Search</span>
                    <kbd className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600 font-mono">Ctrl/⌘ + K</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                    <span className="text-slate-300 text-sm">Plugin Manager</span>
                    <kbd className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600 font-mono">Ctrl/⌘ + P</kbd>
                  </div>
                  <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                    <span className="text-slate-300 text-sm">Show Shortcuts</span>
                    <kbd className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded border border-slate-600 font-mono">Ctrl/⌘ + /</kbd>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex-1 flex flex-col min-w-0">`);
}

fs.writeFileSync('src/components/CloudOS.tsx', code);
