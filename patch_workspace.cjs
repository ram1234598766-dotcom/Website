const fs = require('fs');
let code = fs.readFileSync('src/components/CloudOS.tsx', 'utf8');

code = code.replace(
/                    drag\n\s*dragConstraints=\{\{ top: 0, left: 0, right: 0, bottom: 0 \}\}\n\s*dragElastic=\{0\.02\}\n\s*className="flex-1 relative"/,
`                    drag
                    dragConstraints={{ top: -200, left: -200, right: 200, bottom: 200 }}
                    dragElastic={0.15}
                    dragMomentum={true}
                    dragTransition={{ bounceStiffness: 400, bounceDamping: 20 }}
                    whileDrag={{ cursor: "grabbing" }}
                    className="flex-1 relative cursor-grab"`
);

fs.writeFileSync('src/components/CloudOS.tsx', code);
