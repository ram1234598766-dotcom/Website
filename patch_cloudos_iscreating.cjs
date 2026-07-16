const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// Insert isCreating back
code = code.replace(/const \[newFileName, setNewFileName\] = useState\(''\);/, `const [isCreating, setIsCreating] = useState(false);\n  const [newFileName, setNewFileName] = useState('');`);

fs.writeFileSync('src/components/CloudOS.tsx', code);
