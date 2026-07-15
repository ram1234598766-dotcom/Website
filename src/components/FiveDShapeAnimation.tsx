import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// 5D Hypercube (Penteract) projection
function Penteract({ pointer }: { pointer: THREE.Vector2 }) {
  const linesRef = useRef<THREE.Group>(null);
  
  // Generate 32 vertices of a 5D hypercube
  const vertices5D = useMemo(() => {
    const v = [];
    for (let i = 0; i < 32; i++) {
      v.push([
        (i & 1) ? 1 : -1,
        (i & 2) ? 1 : -1,
        (i & 4) ? 1 : -1,
        (i & 8) ? 1 : -1,
        (i & 16) ? 1 : -1
      ]);
    }
    return v;
  }, []);

  // Edges connect vertices that differ by exactly 1 bit
  const edges = useMemo(() => {
    const e = [];
    for (let i = 0; i < 32; i++) {
      for (let j = i + 1; j < 32; j++) {
        let diffs = 0;
        for (let k = 0; k < 5; k++) {
          if (vertices5D[i][k] !== vertices5D[j][k]) diffs++;
        }
        if (diffs === 1) e.push([i, j]);
      }
    }
    return e;
  }, [vertices5D]);

  // Materials and Geometries for edges
  const linesGeom = useMemo(() => {
    return edges.map(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
  }, [edges]);

  const material = useMemo(() => new THREE.LineBasicMaterial({ 
    color: 0x38bdf8, 
    transparent: true, 
    opacity: 0.4,
    blending: THREE.AdditiveBlending 
  }), []);

  const materialHighlight = useMemo(() => new THREE.LineBasicMaterial({ 
    color: 0x10b981, 
    transparent: true, 
    opacity: 0.8,
    blending: THREE.AdditiveBlending 
  }), []);

  // 5D Rotation state
  const angles = useRef(new Array(10).fill(0));

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Base rotations + mouse interaction
    const targetRotX = state.pointer.x * 2;
    const targetRotY = state.pointer.y * 2;
    
    angles.current[0] = time * 0.3 + targetRotX; // XY
    angles.current[1] = time * 0.2; // XZ
    angles.current[2] = time * 0.4 + targetRotY; // XW
    angles.current[3] = time * 0.1; // XV
    angles.current[4] = time * 0.25; // YZ
    angles.current[5] = time * 0.15; // YW
    angles.current[6] = time * 0.35; // YV
    angles.current[7] = time * 0.05; // ZW
    angles.current[8] = time * 0.45; // ZV
    angles.current[9] = time * 0.2; // WV

    // Rotation helper
    const rotate = (v: number[], i: number, j: number, theta: number) => {
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const vi = v[i];
      const vj = v[j];
      v[i] = vi * cos - vj * sin;
      v[j] = vi * sin + vj * cos;
    };

    // Project 5D -> 3D
    const projected: THREE.Vector3[] = [];
    
    for (let i = 0; i < 32; i++) {
      const v = [...vertices5D[i]];
      
      // Apply 10 rotations
      rotate(v, 0, 1, angles.current[0]);
      rotate(v, 0, 2, angles.current[1]);
      rotate(v, 0, 3, angles.current[2]);
      rotate(v, 0, 4, angles.current[3]);
      rotate(v, 1, 2, angles.current[4]);
      rotate(v, 1, 3, angles.current[5]);
      rotate(v, 1, 4, angles.current[6]);
      rotate(v, 2, 3, angles.current[7]);
      rotate(v, 2, 4, angles.current[8]);
      rotate(v, 3, 4, angles.current[9]);
      
      // Perspective projection 5D -> 4D
      const distance4D = 3;
      const w5 = 1 / (distance4D - v[4]);
      const x4 = v[0] * w5;
      const y4 = v[1] * w5;
      const z4 = v[2] * w5;
      const w4 = v[3] * w5;
      
      // Perspective projection 4D -> 3D
      const distance3D = 2;
      const w = 1 / (distance3D - w4);
      const x = x4 * w;
      const y = y4 * w;
      const z = z4 * w;
      
      // Scale up for visibility
      projected.push(new THREE.Vector3(x * 3, y * 3, z * 3));
    }
    
    // Update line geometries
    if (linesRef.current) {
      edges.forEach((edge, idx) => {
        const line = linesRef.current!.children[idx] as THREE.Line;
        const positions = line.geometry.attributes.position.array as Float32Array;
        const p1 = projected[edge[0]];
        const p2 = projected[edge[1]];
        positions[0] = p1.x; positions[1] = p1.y; positions[2] = p1.z;
        positions[3] = p2.x; positions[4] = p2.y; positions[5] = p2.z;
        line.geometry.attributes.position.needsUpdate = true;
      });
    }
  });

  return (
    <group ref={linesRef}>
      {edges.map((edge, i) => (
        <primitive object={new THREE.Line(linesGeom[i], i % 3 === 0 ? materialHighlight : material)} key={i} />
      ))}
    </group>
  );
}

function Scene() {
  const { pointer } = useThree();
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} color="#38bdf8" />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#10b981" />
      <Penteract pointer={pointer} />
      <OrbitControls 
        enableZoom={false} 
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.0}
      />
    </>
  );
}

export default function FiveDShapeAnimation() {
  return (
    <div className="w-full h-96 sm:h-[500px] relative rounded-2xl overflow-hidden border border-slate-800 bg-[#020617] shadow-[0_0_50px_-12px_rgba(16,185,129,0.2)] group flex-1">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-[#020617] to-emerald-900/20 z-0 pointer-events-none" />
      
      <div className="absolute top-6 left-6 z-20 flex items-center gap-3">
         <div className="relative flex items-center justify-center">
           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping absolute"></div>
           <div className="w-2 h-2 rounded-full bg-emerald-400 relative z-10 shadow-[0_0_10px_#10b981]"></div>
         </div>
         <span className="text-emerald-400/90 font-mono text-xs tracking-[0.2em] uppercase font-bold">5D Hypercube Projection Active</span>
      </div>
      
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }} className="z-10" gl={{ antialias: true, alpha: true }}>
        <Scene />
      </Canvas>
      
      <div className="absolute bottom-6 right-6 z-20">
          <div className="px-4 py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg font-mono text-[10px] text-slate-400 tracking-wider flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
             INTERACTIVE // DRAG OR MOVE MOUSE
          </div>
      </div>
    </div>
  );
}
