const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// 1. Remove settings button
code = code.replace(/<div className="p-4 border-t border-slate-800">\s*<button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg text-sm transition-colors">\s*<Settings className="w-4 h-4" \/>\s*Settings\s*<\/button>\s*<\/div>/g, '');

// 2. Remove Plugin Store block
code = code.replace(/\{\/\* Plugin Store \*\/\}(.|\n)*?<\/motion\.div>\s*<\/div>\s*\)\}\s*<\/AnimatePresence>/g, '');

// 3. Remove Keyboard Shortcuts block
code = code.replace(/\{\/\* Keyboard Shortcuts \*\/\}(.|\n)*?<\/motion\.div>\s*<\/div>\s*\)\}\s*<\/AnimatePresence>/g, '');

// 4. Remove plugin fetching useEffect
code = code.replace(/\/\/ Plugin Store Fetch(.|\n)*?setRegistryLoading\(false\);\n\s*\}\n\s*\}, \[showPlugins, pluginSearch\]\);/g, '');

// 5. Remove plugins state, showPlugins state, showShortcuts state, pluginSearch, registryLoading
code = code.replace(/const \[showPlugins, setShowPlugins\] = useState\(false\);\n  const \[showShortcuts, setShowShortcuts\] = useState\(false\);\n  const \[plugins, setPlugins\] = useState<Record<string, PluginMeta>>\(DEFAULT_PLUGINS\);\n  const \[pluginSearch, setPluginSearch\] = useState\(initialPluginSearch \|\| ''\);\n  const \[registryLoading, setRegistryLoading\] = useState\(false\);/g, '');

// 6. Remove Ctrl+P / Ctrl+/ keydown listeners
code = code.replace(/\} else if \(\(e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === 'p' \|\| e\.key === 'P'\)\) \{\n\s*e\.preventDefault\(\);\n\s*setShowPlugins\(prev => !prev\);\n\s*\} else if \(\(e\.ctrlKey \|\| e\.metaKey\) && e\.key === '\/'\) \{\n\s*e\.preventDefault\(\);\n\s*setShowShortcuts\(prev => !prev\);/g, '');

// 7. Remove Prettier formatting condition
code = code.replace(/if \(!plugins\['prettier'\]\?\.active\) \{\n\s*setTerminalOutput\('Error: Prettier plugin is not enabled.'\);\n\s*setShowOutput\(true\);\n\s*return;\n\s*\}/g, '');

// 8. Remove GitLens formatting condition
code = code.replace(/\{plugins\['gitlens'\]\?\.active && \(\n\s*(<button(.|\n)*?<\/button>)\n\s*\)\}/g, '$1');

// 9. Fix syncSettingsToCloud calling `plugins`
code = code.replace(/saveSettingsToCloud\(\{ editorTheme, openTabs, plugins \}\);/g, 'saveSettingsToCloud({ editorTheme, openTabs });');

fs.writeFileSync('src/components/CloudOS.tsx', code);
