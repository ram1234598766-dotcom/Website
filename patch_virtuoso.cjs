const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/import \{ FixedSizeList as List \} from 'react-window';/,
"import { Virtuoso } from 'react-virtuoso';"
);

code = code.replace(
/<\s*List\s+height=\{600\}\s+itemCount=\{files\.length\}\s+itemSize=\{40\}\s+width="100%"\s*>[\s\S]*?\{file\.name\}\n\s*<\/span>\n\s*\)\}\n\s*<\/div>\n\s*<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">\n\s*<button\n\s*onClick=\{\(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*setRenamingFileId\(file\.id\);\n\s*setRenameValue\(file\.name\);\n\s*\}\}\n\s*className="p-1\.5 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors"\n\s*>\n\s*<Edit2 className="w-3\.5 h-3\.5" \/>\n\s*<\/button>\n\s*<button\n\s*onClick=\{\(e\) => handleDeleteFile\(file\.id, e\)\}\n\s*className="p-1\.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"\n\s*>\n\s*<Trash2 className="w-3\.5 h-3\.5" \/>\n\s*<\/button>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*\);\n\s*\}\}\n\s*<\/List>/,
`<Virtuoso
                style={{ height: 600, width: '100%' }}
                totalCount={files.length}
                itemContent={(index) => {
                  const file = files[index];
                  return (
                    <div className="pr-2 py-0.5">
                      <div
                        onClick={() => {
                          setActiveFileId(file.id);
                          if (!openTabs.includes(file.id)) {
                            setOpenTabs([...openTabs, file.id]);
                          }
                        }}
                        className={\`w-full h-full group flex items-center justify-between px-3 rounded-lg text-sm transition-all cursor-pointer \${
                          activeFileId === file.id
                            ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                        }\`}
                      >
                        <div className="flex items-center gap-3 w-full">
                          {getFileIcon(file.language)}
                          {renamingFileId === file.id ? (
                            <form onSubmit={(e) => handleRenameSubmit(file.id, e)} className="w-full">
                               <input
                                 type="text"
                                 autoFocus
                                 value={renameValue}
                                 onChange={e => setRenameValue(e.target.value)}
                                 onBlur={() => setRenamingFileId(null)}
                                 className="bg-transparent border-none outline-none text-sm text-slate-200 w-full"
                               />
                            </form>
                          ) : (
                            <span 
                               className="truncate flex-1"
                               onDoubleClick={(e) => {
                                 e.stopPropagation();
                                 setRenamingFileId(file.id);
                                 setRenameValue(file.name);
                               }}
                            >
                              {file.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingFileId(file.id);
                              setRenameValue(file.name);
                            }}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-indigo-400 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteFile(file.id, e)}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />`
);

// Terminal Virtuoso
code = code.replace(
/<\s*List\s+height=\{256\}\s+itemCount=\{terminalOutput\.split\('\\n'\)\.length\}\s+itemSize=\{20\}\s+width="100%"\s*>[\s\S]*?\{terminalOutput\.split\('\\n'\)\[index\]\}\n\s*<\/div>\n\s*\)\}\n\s*<\/List>/,
`<Virtuoso
                            style={{ height: 256, width: '100%' }}
                            totalCount={terminalOutput.split('\\n').length}
                            itemContent={(index) => (
                              <div className="px-4 whitespace-pre-wrap">
                                {terminalOutput.split('\\n')[index]}
                              </div>
                            )}
                          />`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
