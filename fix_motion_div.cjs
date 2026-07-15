const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/<div\n\s*onClick=\{\(\) => \{\n\s*setActiveFileId\(file\.id\);\n\s*if \(!openTabs\.includes\(file\.id\)\) \{\n\s*setOpenTabs\(\[\.\.\.openTabs, file\.id\]\);\n\s*\}\n\s*\}\}\n\s*as=\{motion\.div as any\}\n\s*whileHover=\{\{ scale: 1\.01, backgroundColor: "rgba\(255, 255, 255, 0\.05\)" \}\}\n\s*whileTap=\{\{ scale: 0\.98 \}\}\n\s*className/g,
`<motion.div
                        onClick={() => {
                          setActiveFileId(file.id);
                          if (!openTabs.includes(file.id)) {
                            setOpenTabs([...openTabs, file.id]);
                          }
                        }}
                        whileHover={{ scale: 1.01, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                        whileTap={{ scale: 0.98 }}
                        className`
);

code = code.replace(
/<\/div>\n\s*<\/div>\n\s*\);\n\s*\}\}\n\s*\/>/g,
`</motion.div>\n                    </div>\n                  );\n                }}\n              />`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
