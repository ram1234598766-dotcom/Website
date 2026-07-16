const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
  "    } catch (e: any) {\n      setTerminalOutput('Format error: ' + e.message);\n      setShowOutput(true);\n    }",
  "    } catch (e: any) {\n      console.error('Format error:', e);\n      alert('Format error: ' + e.message);\n    }"
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
