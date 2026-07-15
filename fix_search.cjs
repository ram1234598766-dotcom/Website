const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const regex = /\{searchResults\.length > 0 && \([\s\S]*?<\/List>\n\s*<\/div>\n\s*\)\}/;

const fixed = `{searchResults.length > 0 && (
                <div className="max-h-[300px] overflow-y-auto">
                  {searchResults.map((result, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setActiveFileId(result.id);
                        if (!openTabs.includes(result.id)) {
                          setOpenTabs([...openTabs, result.id]);
                        }
                        setIsSearchOpen(false);
                      }}
                      className="px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-300 font-bold">
                        {getFileIcon(files.find(f => f.id === result.id)?.language || 'txt')}
                        {result.name}
                      </div>
                      {result.line && (
                        <div className="text-xs text-slate-400 font-mono truncate">
                          <span className="text-indigo-400 mr-2">Line {result.lineNum}:</span>
                          {result.line}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}`;

code = code.replace(regex, fixed);
fs.writeFileSync('src/components/CloudOS.tsx', code);
