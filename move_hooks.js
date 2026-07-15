const fs = require('fs');

let content = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

// The block to extract
const blockToExtract = `  // Firebase syncing logic
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    const settingsRef = doc(db, 'user_ide_settings', user.uid);
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.editorTheme) setEditorTheme(data.editorTheme);
        if (data.openTabs) setOpenTabs(data.openTabs);
        if (data.plugins) setPlugins(data.plugins);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const saveSettingsToCloud = async (newSettings: any) => {
    const user = auth.currentUser;
    if (!user) return;
    
    setSyncStatus('syncing');
    try {
      const settingsRef = doc(db, 'user_ide_settings', user.uid);
      await setDoc(settingsRef, newSettings, { merge: true });
      setSyncStatus('idle');
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    }
  };

  // Trigger save on settings change
  useEffect(() => {
    saveSettingsToCloud({ editorTheme, openTabs, plugins });
  }, [editorTheme, openTabs, plugins]);`;

content = content.replace(blockToExtract, '');

const searchTarget = `  const [editorTheme, setEditorTheme] = useState('vs-dark');`;
content = content.replace(searchTarget, searchTarget + '\n\n' + blockToExtract);

fs.writeFileSync('src/components/CloudOS.tsx', content);
