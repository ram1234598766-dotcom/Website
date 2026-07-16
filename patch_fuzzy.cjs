const fs = require('fs');
let code = fs.readFileSync('src/components/CommandPalette.tsx', 'utf8');

const target = `  let filteredItems = items;
  if (query && !isPluginSearch) {
    const lowerQuery = query.toLowerCase();
    // basic fuzzy match
    filteredItems = items.filter(item => 
      item.name.toLowerCase().includes(lowerQuery) || 
      item.description?.toLowerCase().includes(lowerQuery)
    );
  }`;

const replacement = `  const fuzzyMatch = (str: string, pattern: string) => {
    let i = 0, j = 0;
    const s = str.toLowerCase();
    const p = pattern.toLowerCase();
    while (i < s.length && j < p.length) {
      if (s[i] === p[j]) j++;
      i++;
    }
    return j === p.length;
  };

  let filteredItems = items;
  if (query && !isPluginSearch) {
    filteredItems = items.filter(item => 
      fuzzyMatch(item.name, query) || 
      (item.description && fuzzyMatch(item.description, query))
    );
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/CommandPalette.tsx', code);
