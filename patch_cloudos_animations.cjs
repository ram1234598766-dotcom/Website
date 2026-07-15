const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Add motion to tabs
code = code.replace(/<div \n                    key=\{tabId\}\n                    onClick=\{\(\) => setActiveFileId\(tabId\)\}/g,
`<motion.div 
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={tabId}
                    onClick={() => setActiveFileId(tabId)}`);
                    
code = code.replace(/className=\{\`flex items-center gap-2 px-4 py-2 text-sm font-mono cursor-pointer border-r border-slate-800 min-w-\[120px\] max-w-\[200px\] group \$\{activeFileId === tabId \? 'bg-\[#1e1e1e\] text-slate-300 border-t-2 border-t-indigo-500' : 'bg-slate-900 text-slate-500 border-t-2 border-t-transparent hover:bg-slate-800'\}\`\}\n                  >\n                    \{getFileIcon\(tabFile.language\)\}\n                    <span className="truncate flex-1">\{tabFile.name\}<\/span>\n                    <button/g,
`className={\`flex items-center gap-2 px-4 py-2 text-sm font-mono cursor-pointer border-r border-slate-800 min-w-[120px] max-w-[200px] group \${activeFileId === tabId ? 'bg-[#1e1e1e] text-slate-300 border-t-2 border-t-indigo-500' : 'bg-slate-900 text-slate-500 border-t-2 border-t-transparent hover:bg-slate-800'}\`}
                  >
                    {getFileIcon(tabFile.language)}
                    <span className="truncate flex-1">{tabFile.name}</span>
                    <button`);
                    
code = code.replace(/<\/div>\n                \);\n              \}\)}\n            <\/div>/,
`</motion.div>
                );
              })}
            </AnimatePresence>
            </div>`);
            
code = code.replace(/<div className="flex overflow-x-auto shrink-0" style=\{\{ scrollbarWidth: 'none' \}\}>\n              \{openTabs\.map\(tabId => \{/g,
`<div className="flex overflow-x-auto shrink-0 cloudos-scroll" style={{ scrollbarWidth: 'thin', scrollBehavior: 'smooth' }}>
              <AnimatePresence>
              {openTabs.map(tabId => {`);

fs.writeFileSync('src/components/CloudOS.tsx', code);
