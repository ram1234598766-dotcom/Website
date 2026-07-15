const fs = require('fs');
let code = fs.readFileSync('src/components/FiveDShapeAnimation.tsx', 'utf8');

code = code.replace(
  `    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.x = Math.sin(time * 0.5) * 0.2;
    pointsRef.current.rotation.y += 0.001;
  });`,
  `    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    
    // Mouse tracking physics for swarm
    const targetX = Math.sin(time * 0.5) * 0.2 + (state.pointer.y * 0.5);
    const targetY = (time * 0.1) + (state.pointer.x * 1.5);
    
    pointsRef.current.rotation.x += (targetX - pointsRef.current.rotation.x) * 0.05;
    pointsRef.current.rotation.y += (targetY - pointsRef.current.rotation.y) * 0.05;
  });`
);

code = code.replace(
  `       const time = state.clock.elapsedTime;
       if (meshRef.current) {
           meshRef.current.rotation.x = time * 0.2;
           meshRef.current.rotation.y = time * 0.3;
           const s = 1.0 + Math.sin(time * 2) * 0.05;
           meshRef.current.scale.set(s,s,s);
       }
       if (wireRef.current) {
           wireRef.current.rotation.x = -time * 0.1;
           wireRef.current.rotation.y = -time * 0.2;
           const s = 1.2 + Math.cos(time * 1.5) * 0.05;
           wireRef.current.scale.set(s,s,s);
       }`,
  `       const time = state.clock.elapsedTime;
       
       // Mouse tracking physics for core
       const mouseRotX = state.pointer.y * 2;
       const mouseRotY = state.pointer.x * 2;
       
       // Dynamic scale based on mouse distance from center
       const mouseDist = Math.sqrt(state.pointer.x * state.pointer.x + state.pointer.y * state.pointer.y);
       
       if (meshRef.current) {
           const targetX = time * 0.2 + mouseRotX;
           const targetY = time * 0.3 + mouseRotY;
           meshRef.current.rotation.x += (targetX - meshRef.current.rotation.x) * 0.05;
           meshRef.current.rotation.y += (targetY - meshRef.current.rotation.y) * 0.05;
           
           const targetS = 1.0 + Math.sin(time * 2) * 0.05 + mouseDist * 0.3;
           meshRef.current.scale.x += (targetS - meshRef.current.scale.x) * 0.1;
           meshRef.current.scale.y += (targetS - meshRef.current.scale.y) * 0.1;
           meshRef.current.scale.z += (targetS - meshRef.current.scale.z) * 0.1;
       }
       if (wireRef.current) {
           const targetX = -time * 0.1 + mouseRotX;
           const targetY = -time * 0.2 + mouseRotY;
           wireRef.current.rotation.x += (targetX - wireRef.current.rotation.x) * 0.05;
           wireRef.current.rotation.y += (targetY - wireRef.current.rotation.y) * 0.05;
           
           const targetS = 1.2 + Math.cos(time * 1.5) * 0.05 + mouseDist * 0.4;
           wireRef.current.scale.x += (targetS - wireRef.current.scale.x) * 0.1;
           wireRef.current.scale.y += (targetS - wireRef.current.scale.y) * 0.1;
           wireRef.current.scale.z += (targetS - wireRef.current.scale.z) * 0.1;
       }`
);

fs.writeFileSync('src/components/FiveDShapeAnimation.tsx', code);
