const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const target = `      setActiveFileId: (id: string) => {
        if (!openTabs.includes(id)) {
          setOpenTabs([...openTabs, id]);
        }
        setActiveFileId(id);
      },`;

const replacement = `      setActiveFileId: (id: string) => {
        setOpenTabs((prev: string[]) => {
          if (!prev.includes(id)) return [...prev, id];
          return prev;
        });
        setActiveFileId(id);
      },`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/CloudOS.tsx', code);
