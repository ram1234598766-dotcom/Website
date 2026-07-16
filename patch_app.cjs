const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove pluginSearchQuery state
code = code.replace(/const \[pluginSearchQuery, setPluginSearchQuery\] = useState\(''\);\n/g, '');

// Remove initialPluginSearch prop
code = code.replace(/initialPluginSearch=\{pluginSearchQuery\}/g, '');

// Remove onSearchPlugins prop
code = code.replace(/onSearchPlugins=\{\(q\) => setPluginSearchQuery\(q\)\}/g, '');

fs.writeFileSync('src/App.tsx', code);
