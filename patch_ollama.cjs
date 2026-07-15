const fs = require('fs');
let code = fs.readFileSync('src/components/OllamaLocal.tsx', 'utf8');

code = code.replace(
`      setStatus('disconnected');
      setError('Connection Failed: Could not connect to Ollama. Ensure it is running locally on port 11434 and CORS is enabled. To allow browser access, set OLLAMA_ORIGINS="*" before starting the Ollama server.');`,
`      setStatus('disconnected');
      setError('Connection to local daemon failed. Switching to Cloud Fallback via Backend Software...');
      
      // Fallback to Gemini
      setTimeout(() => {
        setModels([{ name: 'gemini-fallback', size: 0, digest: '', modified_at: '' }]);
        setSelectedModel('gemini-fallback');
        setStatus('connected');
        setError(null);
      }, 1500);`
);

code = code.replace(
`      const res = await fetch(\`\${ollamaUrl}/api/generate\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt,
          stream: true,
        }),
      });`,
`      let res;
      let isFallback = selectedModel === 'gemini-fallback';
      
      if (isFallback) {
          res = await fetch('/api/ai/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt })
          });
      } else {
          res = await fetch(\`\${ollamaUrl}/api/generate\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: selectedModel,
              prompt: prompt,
              stream: true,
            }),
          });
      }`
);

code = code.replace(
`      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content += parsed.response;
                return newMsgs;
              });
            }
          } catch (e) {
            // ignore JSON parse errors on partial chunks
          }
        }
      }`,
`      if (isFallback) {
          const data = await res.json();
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1].content = data.text;
            return newMsgs;
          });
      } else {
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No readable stream');

          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\\n');
            
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.response) {
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].content += parsed.response;
                    return newMsgs;
                  });
                }
              } catch (e) {
                // ignore JSON parse errors on partial chunks
              }
            }
          }
      }`
);

fs.writeFileSync('src/components/OllamaLocal.tsx', code);
