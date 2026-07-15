const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/              \}\)\n            <\/motion\.div>\n          \}\)/,
`              )}
            </motion.div>
          )}
        </AnimatePresence>`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
