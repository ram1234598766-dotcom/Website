const fs = require('fs');
let code = fs.readFileSync('src/components/Navigation.tsx', 'utf8');

if (!code.includes('UserPlus')) {
  code = code.replace(/import \{ ViewState \} from '\.\.\/types';\nimport \{([^}]+)\} from 'lucide-react';/, `import { ViewState } from '../types';\nimport {$1, UserPlus, LogIn} from 'lucide-react';`);
}

code = code.replace(/Sign In\n            <\/button>/g, `<LogIn className="w-4 h-4 inline-block mr-1"/> Sign In\n            </button>`);
code = code.replace(/Sign Up\n            <\/button>/g, `<UserPlus className="w-4 h-4 inline-block mr-1"/> Sign Up\n            </button>`);

code = code.replace(/Sign In\n          <\/button>/g, `<LogIn className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign In\n          </button>`);
code = code.replace(/Sign Up\n          <\/button>/g, `<UserPlus className="w-4 h-4 inline-block mr-2 mb-0.5"/> Sign Up\n          </button>`);

fs.writeFileSync('src/components/Navigation.tsx', code);
