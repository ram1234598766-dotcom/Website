const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/            <AnimatePresence>\n\s*\{files\.map\(\(file\) => \(\n\s*<motion\.div\n\s*key=\{file\.id\}[\s\S]*?(?=<\/AnimatePresence>)/,
`            <div className="h-full w-full">
              <List
                height={600}
                itemCount={files.length}
                itemSize={40}
                width="100%"
              >
                {({ index, style }) => {
                  const file = files[index];
                  return (
                    <div style={style} className="pr-2 py-0.5">
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
              </List>
            </div>
            `
);

code = code.replace(/<\/AnimatePresence>/, ""); // Since we matched everything before it but not it itself, we need to remove it manually. Wait! My regex stopped before `</AnimatePresence>`. I'll just remove the first remaining `</AnimatePresence>`. Wait, no, it's better to just do this:

fs.writeFileSync('src/components/CloudOS.tsx', code);
