'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, PresentationControls, Float, ContactShadows, Environment } from '@react-three/drei';
import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';

//Upright ring full res
const ringModel = '/oliviasRing2.glb';
//Rotated 45 degrees on y axis low res
//const ringModel = '/oliviasRing.glb';
//Jonahs ring full res
//const ringModel = '/jonahRing.glb';

function Ring({ rotationRef }: { rotationRef: React.MutableRefObject<{ y: number }> }) {
    const { scene: gltfScene } = useGLTF(ringModel);
    const scene = useMemo(() => {
        const cloned = gltfScene.clone();
        cloned.traverse((node) => {
            if (node instanceof THREE.Light) {
                node.visible = false;
            }
            if (node instanceof THREE.Mesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material instanceof THREE.MeshStandardMaterial) {
                    node.material.envMapIntensity = 1.5;
                }
            }
        });
        return cloned;
    }, [gltfScene]);

    const meshRef = useRef<THREE.Group>(null);

    useFrame((_state, delta) => {
        if (meshRef.current) {
            rotationRef.current.y += delta * 0.4;
            meshRef.current.rotation.y = rotationRef.current.y;
        }
    });

    return (
        <primitive
            ref={meshRef}
            object={scene}
            scale={5}
            position={[0, 0, 0]}
        />
    );
}

interface InteractiveRingProps {
    className?: string;
}

export default function InteractiveRing({ className = '' }: InteractiveRingProps) {

    const rotationRef = useRef({ y: 0 });

    return (
        <div
            className={`w-48 sm:w-56 md:w-64 h-48 sm:h-56 md:h-64 ${className}`}
            style={{ cursor: 'grab' }}
        >
            <Canvas
                camera={{ position: [0, 0, 8], fov: 45 }}
                gl={{ alpha: true, antialias: true }}
                shadows
            >
                {/*
                FIXED LIGHTING:
                original lighting 
                */}
                <pointLight position={[3, 3, 3]} intensity={200} />
                <pointLight position={[-4, -1, 8]} intensity={120} />
                <pointLight position={[-3, 3, -4]} intensity={200} />
                <ambientLight intensity={5} />

                {/* <ambientLight intensity={1} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={500} castShadow />
                <pointLight position={[-10, -10, -10]} intensity={300} />
                <pointLight position={[5, 5, 5]} intensity={400} /> */}

                {/* Environment map provides realistic metallic reflections */}
                <Suspense fallback={null}>
                    <Environment preset="city" />

                    <PresentationControls
                        global
                        snap
                        rotation={[0, 0, 0]}
                        polar={[-Math.PI / 3, Math.PI / 3]}
                        azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
                    >
                        <Float
                            speed={2}
                            rotationIntensity={0.2}
                            floatIntensity={0.5}
                            floatingRange={[-0.1, 0.1]}
                        >
                            <Ring rotationRef={rotationRef} />
                        </Float>
                    </PresentationControls>

                    {/* Floor shadow*/}
                    <ContactShadows
                        position={[0, -2, 0]}
                        opacity={0.4}
                        scale={10}
                        blur={2.5}
                        far={4}
                    />
                </Suspense>
            </Canvas>
        </div>
    );
}
// Preload the model to avoid pop-in
useGLTF.preload(ringModel);
