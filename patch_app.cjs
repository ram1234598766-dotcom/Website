const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
/import \{ useState, useEffect \} from 'react';/,
`import { useState, useEffect } from 'react';\nimport { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';`
);

code = code.replace(
/  const \[showAuthModal, setShowAuthModal\] = useState\(false\);\n  const \[authMode, setAuthMode\] = useState<'signin' | 'signup'>\('signin'\);/,
`  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [securityStatus, setSecurityStatus] = useState<'checking' | 'secure' | 'threat'>('checking');
  
  useEffect(() => {
    fetch('/api/security/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: 'ping' })
    }).then(res => res.json()).then(data => {
      setSecurityStatus(data.threatsFound ? 'threat' : 'secure');
    }).catch(() => setSecurityStatus('threat'));
  }, []);`
);

code = code.replace(
/<button onClick=\{\(\) => setCurrentView\('privacy'\)\} className="text-slate-600 hover:text-indigo-600 transition-colors">Data Privacy & Ownership<\/button>/,
`<motion.div 
                animate={ securityStatus === 'secure' ? { backgroundColor: '#dcfce7', color: '#166534' } : securityStatus === 'threat' ? { backgroundColor: '#fee2e2', color: '#991b1b' } : { backgroundColor: '#f1f5f9', color: '#475569' } }
                className="px-3 py-1 rounded-full flex items-center gap-2 font-medium"
              >
                {securityStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
                {securityStatus === 'secure' && <ShieldCheck className="w-4 h-4" />}
                {securityStatus === 'threat' && <ShieldAlert className="w-4 h-4" />}
                <span>{securityStatus === 'checking' ? 'Checking Security...' : securityStatus === 'secure' ? 'Secure Runtime' : 'Threat Detected'}</span>
              </motion.div>
              <button onClick={() => setCurrentView('privacy')} className="text-slate-600 hover:text-indigo-600 transition-colors">Data Privacy & Ownership</button>`
);

fs.writeFileSync('src/App.tsx', code);
