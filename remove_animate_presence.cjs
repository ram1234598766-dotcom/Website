const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/              <\/List>\n\s*<\/div>\n\s*<\/AnimatePresence>/,
`              </List>
            </div>`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
