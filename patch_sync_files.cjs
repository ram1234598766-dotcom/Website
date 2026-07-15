const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/const syncFiles = async \(\) => \{\n\s*setSyncStatus\('syncing'\);\n\s*try \{\n\s*for \(const f of files\) \{\n\s*await supabase\.from\('workspace_files'\)\.upsert\(\{\n\s*id: f\.id,\n\s*name: f\.name,\n\s*content: f\.content,\n\s*language: f\.language\n\s*\}\);\n\s*\}\n\s*setSyncStatus\('idle'\);\n\s*\} catch \(e\) \{\n\s*setSyncStatus\('error'\);\n\s*\}\n\s*\};/,
`const syncFiles = async () => {
        setSyncStatus('syncing');
        try {
          // Server-side validation via Supabase Edge Functions (Mocked in our server)
          const token = await auth.currentUser?.getIdToken();
          const authRes = await fetch('/api/edge-functions/auth-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': \`Bearer \${token}\`
            },
            body: JSON.stringify({ action: 'sync' })
          });
          
          if (!authRes.ok) {
            throw new Error('Server-side authentication failed in Edge Function');
          }
          
          for (const f of files) {
             await supabase.from('workspace_files').upsert({
                id: f.id,
                name: f.name,
                content: f.content,
                language: f.language
             });
          }
          setSyncStatus('idle');
        } catch (e) {
          console.error(e);
          setSyncStatus('error');
        }
      };`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
