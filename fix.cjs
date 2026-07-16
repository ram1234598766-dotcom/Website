const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
  '<button \n                          className={`text-xs',
  '<button onClick={() => setPlugins(prev => ({ ...prev, [key]: { ...prev[key], active: !prev[key].active } }))}\n                          className={`text-xs'
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
