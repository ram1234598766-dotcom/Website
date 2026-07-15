const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// 1. Add languages
code = code.replace(
/  \{ id: 'lua', name: 'Lua', ext: 'lua' \}\n\];/,
`  { id: 'lua', name: 'Lua', ext: 'lua' },
  { id: 'haskell', name: 'Haskell', ext: 'hs' },
  { id: 'elixir', name: 'Elixir', ext: 'ex' },
  { id: 'r', name: 'R', ext: 'r' },
  { id: 'powershell', name: 'PowerShell', ext: 'ps1' },
  { id: 'clojure', name: 'Clojure', ext: 'clj' },
  { id: 'fsharp', name: 'F#', ext: 'fs' },
  { id: 'pascal', name: 'Pascal', ext: 'pas' },
  { id: 'julia', name: 'Julia', ext: 'jl' },
  { id: 'groovy', name: 'Groovy', ext: 'groovy' },
  { id: 'matlab', name: 'MATLAB', ext: 'm' }
];`
);

// 2. Add pluginSearch state
code = code.replace(
/  const \[plugins, setPlugins\] = useState<Record<string, PluginMeta>>\(DEFAULT_PLUGINS\);/,
`  const [plugins, setPlugins] = useState<Record<string, PluginMeta>>(DEFAULT_PLUGINS);
  const [pluginSearch, setPluginSearch] = useState('');`
);

// 3. Plugin search input
code = code.replace(
/              <button onClick=\{\(\) => setShowPlugins\(false\)\} className="text-slate-500 hover:text-slate-300 font-bold text-xs uppercase tracking-wider">\n\s*Close\n\s*<\/button>\n\s*<\/div>\n\s*<div className="p-4 space-y-3 max-h-\[400px\] overflow-y-auto">/,
`              <button onClick={() => setShowPlugins(false)} className="text-slate-500 hover:text-slate-300 font-bold text-xs uppercase tracking-wider">
                Close
              </button>
            </div>
            <div className="px-4 pt-4">
              <input
                type="text"
                placeholder="Search plugins..."
                value={pluginSearch}
                onChange={(e) => setPluginSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto cloudos-scroll">`
);

// 4. Plugin search filter
code = code.replace(
/\{Object\.entries\(plugins\)\.map\(\(\[key, plugin\]\) => \(/,
`{Object.entries(plugins)
                .filter(([_, plugin]) => plugin.name.toLowerCase().includes(pluginSearch.toLowerCase()) || plugin.description.toLowerCase().includes(pluginSearch.toLowerCase()))
                .map(([key, plugin]) => (`
);

// 5. Compile and Run button mobile layout fix
code = code.replace(
/<div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 select-none shrink-0 z-20 relative">/,
`<div className="min-h-14 py-2 h-auto bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between px-4 select-none shrink-0 z-20 relative gap-3">`
);

code = code.replace(
/        <div className="flex items-center gap-3">\n\s*<button \n\s*onClick=\{\(\) => setIsSearchOpen\(!isSearchOpen\)\}/,
`        <div className="flex flex-wrap items-center gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto flex-1 justify-end">
          <button 
            onClick={() => setIsSearchOpen(!isSearchOpen)}`
);

// 6. Editor spring transition wrapper
code = code.replace(
/<div className="flex-1 relative">/,
`<motion.div 
                    key={activeFileId}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.5 }}
                    className="flex-1 relative"
                  >`
);

code = code.replace(
/                    <\/div>\n\s*\{debuggerActive && \(/,
`                    </motion.div>
                  
                  {debuggerActive && (`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
