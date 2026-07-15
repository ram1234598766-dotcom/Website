const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
/  useEffect\(\(\) => \{\n    fetch\('\/api\/security\/scan', \{\n      method: 'POST',\n      headers: \{ 'Content-Type': 'application\/json' \},\n      body: JSON.stringify\(\{ payload: 'ping' \}\)\n    \}\)\.then\(res => res\.json\(\)\)\.then\(data => \{\n      setSecurityStatus\(data\.threatsFound \? 'threat' : 'secure'\);\n    \}\)\.catch\(\(\) => setSecurityStatus\('threat'\)\);\n  \}, \[\]\);/,
`  useEffect(() => {
    const checkSecurity = () => {
      setSecurityStatus('checking');
      fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: 'ping' })
      }).then(res => res.json()).then(data => {
        setSecurityStatus(data.threatsFound ? 'threat' : 'secure');
      }).catch(() => setSecurityStatus('threat'));
    };
    checkSecurity();
    const interval = setInterval(checkSecurity, 15000);
    return () => clearInterval(interval);
  }, []);`
);

code = code.replace(
/                animate=\{ securityStatus === 'secure' \? \{ backgroundColor: '#dcfce7', color: '#166534' \} : securityStatus === 'threat' \? \{ backgroundColor: '#fee2e2', color: '#991b1b' \} : \{ backgroundColor: '#f1f5f9', color: '#475569' \} \}\n                className="px-3 py-1 rounded-full flex items-center gap-2 font-medium"/,
`                animate={ securityStatus === 'secure' ? { backgroundColor: '#dcfce7', color: '#166534', scale: [1, 1.05, 1] } : securityStatus === 'threat' ? { backgroundColor: '#fee2e2', color: '#991b1b', scale: [1, 1.1, 1] } : { backgroundColor: '#f1f5f9', color: '#475569' } }
                transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                className="px-3 py-1 rounded-full flex items-center gap-2 font-medium border border-transparent"`
);

fs.writeFileSync('src/App.tsx', code);
