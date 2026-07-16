const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const effectCode = `
  useEffect(() => {
    (window as any).vantaosIDE = {
      files,
      openTabs,
      activeFileId,
      setActiveFileId: (id: string) => {
        setOpenTabs((prev: string[]) => {
          if (!prev.includes(id)) return [...prev, id];
          return prev;
        });
        setActiveFileId(id);
      },
      newFile: () => {
        setCreatingType('file');
        setCreatingParentId(null);
      },
      saveFile: () => {
        // Just simulate a save by formatting or flashing
      },
      openSettings: () => {
        setShowPlugins(true);
      }
    };
    return () => {
      delete (window as any).vantaosIDE;
    };
  }, [files, openTabs, activeFileId, setOpenTabs, setActiveFileId, setCreatingType, setCreatingParentId]);
`;

// Remove the old effect
code = code.replace(effectCode.trim(), '');

// Insert it right before "const toggleFolder = " or "return ("
const target = '  const toggleFolder = (folderId: string) => {';
code = code.replace(target, effectCode + '\n' + target);

fs.writeFileSync('src/components/CloudOS.tsx', code);
