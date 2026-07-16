const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const toolbarStr = `<div className="flex items-center gap-2">
                    
                    <button onClick={() => window.dispatchEvent(new CustomEvent('terminal-send', { detail: 'clear\\n' }))} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Clear Console">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setIsTerminalOpen(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Close Panel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>`;

const newToolbarStr = `<div className="flex items-center gap-2 relative">
                    
                    <button onClick={() => setShowTerminalSettings(!showTerminalSettings)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Terminal Settings">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    
                    {showTerminalSettings && (
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 z-50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-slate-200">Terminal Settings</span>
                          <button onClick={() => setShowTerminalSettings(false)} className="text-slate-400 hover:text-slate-200"><X className="w-3 h-3" /></button>
                        </div>
                        
                        <div className="mb-3">
                          <label className="block text-xs text-slate-400 mb-1">Font Size</label>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range" 
                              min="10" 
                              max="24" 
                              value={terminalFontSize} 
                              onChange={(e) => setTerminalFontSize(parseInt(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                            <span className="text-xs text-slate-300 min-w-[20px]">{terminalFontSize}</span>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Theme</label>
                          <select 
                            value={terminalTheme} 
                            onChange={(e) => setTerminalTheme(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-blue-500"
                          >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                            <option value="dracula">Dracula</option>
                            <option value="monokai">Monokai</option>
                            <option value="ubuntu">Ubuntu</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <button onClick={() => window.dispatchEvent(new CustomEvent('terminal-send', { detail: 'clear\\n' }))} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Clear Console">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setIsTerminalOpen(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200" title="Close Panel">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>`;

if (code.includes('<div className="flex items-center gap-2">')) {
    code = code.replace(toolbarStr, newToolbarStr);
    fs.writeFileSync('src/components/CloudOS.tsx', code);
    console.log("Success");
} else {
    console.log("Could not find toolbar string.");
}
