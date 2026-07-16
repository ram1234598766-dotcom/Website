const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const regex = /<motion\.div\s+key=\{activeFileId\}[\s\S]*?<\/motion\.div>/;

const replace3 = `                  <motion.div 
                    key={\`\${activeFileId}-\${splitMode}-\${secondaryActiveFileId}\`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={\`flex-1 flex \${splitMode === 'stacked' ? 'flex-col' : 'flex-row'} w-full h-full relative\`}
                  >
                    <div className="flex-1 relative min-h-0 min-w-0">
                      {showDiff ? (
                        <DiffEditor height="100%"
                          original={originalFiles[activeFile.id] || ''}
                          modified={activeFile.content}
                          language={activeFile.language}
                          theme={editorTheme}
                          options={{
                            renderSideBySide: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: '"JetBrains Mono", monospace'
                          }}
                        />
                      ) : (
                      <Editor height="100%" className="cloudos-scroll smooth-typing"
                        language={activeFile.language}
                        theme={editorTheme}
                        value={activeFile.content}
                        onChange={(val) => handleEditorChange(val, false)}
                        onMount={handleEditorDidMount}
                        options={{
                          minimap: { enabled: true, renderCharacters: false },
                          fontSize: 14,
                          fontFamily: '"JetBrains Mono", monospace',
                          padding: { top: 16, bottom: 100 },
                          scrollBeyondLastLine: true,
                          smoothScrolling: true,
                          cursorBlinking: "smooth",
                          cursorSmoothCaretAnimation: "on",
                          formatOnPaste: true,
                          automaticLayout: true,
                          wordWrap: 'off',
                          scrollbar: {
                            useShadows: false,
                            verticalScrollbarSize: 12,
                            horizontalScrollbarSize: 12,
                            vertical: 'visible',
                            horizontal: 'visible',
                            verticalSliderSize: 10,
                            horizontalSliderSize: 10,
                          }
                        }}
                        loading={
                          <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                            Loading IDE...
                          </div>
                        }
                      />
                      )}
                    </div>
                    {splitMode !== 'none' && secondaryActiveFileId && (
                      <>
                        <div className={\`bg-slate-800 \${splitMode === 'stacked' ? 'h-[2px] w-full' : 'w-[2px] h-full'} z-10\`} />
                        <div className="flex-1 relative min-h-0 min-w-0">
                          {(() => {
                            const secFile = files.find(f => f.id === secondaryActiveFileId);
                            if (!secFile) return null;
                            return (
                              <Editor height="100%" className="cloudos-scroll smooth-typing"
                                language={secFile.language}
                                theme={editorTheme}
                                value={secFile.content}
                                onChange={(val) => handleEditorChange(val, true)}
                                options={{
                                  minimap: { enabled: true, renderCharacters: false },
                                  fontSize: 14,
                                  fontFamily: '"JetBrains Mono", monospace',
                                  padding: { top: 16, bottom: 100 },
                                  scrollBeyondLastLine: true,
                                  smoothScrolling: true,
                                  cursorBlinking: "smooth",
                                  cursorSmoothCaretAnimation: "on",
                                  formatOnPaste: true,
                                  automaticLayout: true,
                                  wordWrap: 'off',
                                  scrollbar: {
                                    useShadows: false,
                                    verticalScrollbarSize: 12,
                                    horizontalScrollbarSize: 12,
                                    vertical: 'visible',
                                    horizontal: 'visible',
                                    verticalSliderSize: 10,
                                    horizontalSliderSize: 10,
                                  }
                                }}
                                loading={
                                  <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                                    Loading Secondary IDE...
                                  </div>
                                }
                              />
                            );
                          })()}
                        </div>
                      </>
                    )}
                  </motion.div>`;

if (regex.test(code)) {
    code = code.replace(regex, replace3);
    fs.writeFileSync('src/components/CloudOS.tsx', code);
    console.log("target3 replaced");
} else {
    console.log("regex not found");
}

