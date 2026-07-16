const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

const replacement = `
    const loadSettings = async () => {
      if (auth.currentUser) {
         try {
           const docSnap = await getDoc(doc(db, 'workspaces', auth.currentUser.uid));
           if (docSnap.exists()) {
             const data = docSnap.data();
             if (data.settings) {
                if (data.settings.editorTheme) setEditorTheme(data.settings.editorTheme);
                if (data.settings.plugins) setPlugins(data.settings.plugins);
                if (data.settings.openTabs && data.settings.openTabs.length > 0) setOpenTabs(data.settings.openTabs);
             }
           }
         } catch(e) {}
      }
    };
    loadSettings();
    const loadFiles = async () => {`;

code = code.replace("    const loadFiles = async () => {", replacement);

fs.writeFileSync('src/components/CloudOS.tsx', code);
