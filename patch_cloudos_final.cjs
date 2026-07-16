const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// 1. Fix ideState.saveFile and remove openSettings
code = code.replace(/saveFile: \(\) => \{\},[\s\S]*?openSettings: \(\) => \{\}/, `saveFile: () => {
        window.dispatchEvent(new CustomEvent('save-active-file'));
      }`);

// 2. Fix fake syncing in Ctrl+S global listener to actually dispatch save
code = code.replace(/setSyncStatus\('syncing'\);\n\s*setTimeout\(\(\) => setSyncStatus\('idle'\), 500\);/g, `window.dispatchEvent(new CustomEvent('save-active-file'));`);

// 3. Remove dummy terminal tabs
code = code.replace(/<button className="hover:text-slate-200 transition-colors pb-1">Output<\/button>\n\s*<button className="hover:text-slate-200 transition-colors pb-1">Problems<\/button>/g, '');

fs.writeFileSync('src/components/CloudOS.tsx', code);
