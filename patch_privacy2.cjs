const fs = require('fs');
let code = fs.readFileSync('src/components/PrivacyPolicy.tsx', 'utf8');

code = code.replace(/When your models are trained on the VantaOS cloud or P2P mesh:/g, 'When your models are trained on the VantaOS cloud:');
code = code.replace(/\s*<li>You have real-time visibility into which edge nodes are processing your encrypted shards\.<\/li>/g, '');

fs.writeFileSync('src/components/PrivacyPolicy.tsx', code);
