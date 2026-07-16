const fs = require('fs');
let code = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');

// Remove action-settings from actions
const actionSettingsRegex = /\{\s*id:\s*'action-settings'[\s\S]*?\},/g;
code = code.replace(actionSettingsRegex, '');

// Remove pluginQuery logic
const pluginQueryRegex = /const isPluginSearch = query\.toLowerCase\(\)\.startsWith\('plugin '\);\s*const pluginQuery = isPluginSearch \? query\.slice\(7\) : '';/g;
code = code.replace(pluginQueryRegex, '');

const filteredItemsRegex = /if \(query && !isPluginSearch\)/g;
code = code.replace(filteredItemsRegex, 'if (query)');

const pluginSearchLogicRegex = /if \(isPluginSearch\) \{[\s\S]*?\}\s*\];\s*\}/g;
code = code.replace(pluginSearchLogicRegex, '');

fs.writeFileSync('src/components/CommandPalette.tsx', code);
