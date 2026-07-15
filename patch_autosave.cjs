const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

if (!code.includes('import { doc, setDoc } from')) {
  code = code.replace(
    /import \{ getAuth \} from 'firebase\/auth';/,
    `import { getAuth } from 'firebase/auth';\nimport { doc, setDoc } from 'firebase/firestore';\nimport { db } from '../lib/firebase';`
  );
}

const autoSaveHook = `
  // Auto-save mechanism to Firestore
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    const saveToFirestore = async () => {
      try {
        setSyncStatus('syncing');
        await setDoc(doc(db, 'workspaces', user.uid), {
          files: files,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setSyncStatus('synced');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSyncStatus('error');
      }
    };
    
    const interval = setInterval(() => {
      saveToFirestore();
    }, 10000); // Auto-save every 10 seconds
    
    return () => clearInterval(interval);
  }, [files]);
`;

code = code.replace(
/  const saveSettingsToCloud = async/,
  autoSaveHook + '\n  const saveSettingsToCloud = async'
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
