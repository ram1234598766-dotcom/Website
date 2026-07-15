const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/                   \}\)\}\n\s*\}\}\n\s*<\/List>\n\s*<\/div>/,
`                    </div>
                  ))}
                </div>`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
