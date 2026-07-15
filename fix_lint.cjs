const fs = require('fs');

let fivedCode = fs.readFileSync('src/components/FiveDShapeAnimation.tsx', 'utf8');
fivedCode = fivedCode.replace(/\{\/\* @ts-ignore \*\/\}\n\s*<line key=\{i\} geometry=\{linesGeom\[i\]\} material=\{i % 3 === 0 \? materialHighlight : material\} \/>/g, 
  `<line key={i} geometry={linesGeom[i]} material={i % 3 === 0 ? materialHighlight : material} />`);

fivedCode = fivedCode.replace(/<line key=\{i\}/g, 
  `<primitive object={new THREE.Line(linesGeom[i], i % 3 === 0 ? materialHighlight : material)} key={i} />`);
  
fs.writeFileSync('src/components/FiveDShapeAnimation.tsx', fivedCode);

