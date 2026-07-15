const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/setSyncStatus\('error'\);\n\s*\}\n\s*\}\n\s*};\n\s*const getFileIcon = \(lang: string\) => \{/,
`          setSyncStatus('error');
        }
      }
      
      const orig = { ...originalFiles };
      orig[activeFile.id] = activeFile.content;
      setOriginalFiles(orig);
  };
  
  const getFileIcon = (lang: string) => {`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
