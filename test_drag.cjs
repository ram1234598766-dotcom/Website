const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/                    className="flex-1 relative"/,
`                    drag
                    dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
                    dragElastic={0.02}
                    className="flex-1 relative"`
);
fs.writeFileSync('src/components/CloudOS.tsx', code);
