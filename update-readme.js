import fs from 'fs';
let readme = fs.readFileSync('README.md', 'utf8');
readme += `\n\n## Deep-Thinking & Quick-Reply Models\nOpenLayer now features an advanced real-time Omni-AI. You can toggle between Deep-Thinking (advanced multi-step reasoning) and Quick-Reply (low latency) using the top bar. The AI will pull in live data from the web (weather, news, facts, astrology, etc.) in real-time to answer your queries accurately.\n`;
fs.writeFileSync('README.md', readme);
