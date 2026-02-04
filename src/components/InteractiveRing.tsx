'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, PresentationControls, Float, ContactShadows, Environment, Html, useProgress, AdaptiveDpr } from '@react-three/drei';
import { useRef, useMemo, Suspense, useEffect } from 'react';
import * as THREE from 'three';

const RING_MODEL = '/oliviasRing.glb';

function RingLoader() {
    const { progress } = useProgress();

    return (
        <Html center>
            <div className="flex flex-col items-center justify-center w-48">
                <div className="text-black/50 text-[10px] font-medium mb-3 tracking-[0.2em] uppercase whitespace-nowrap">
                    loading ring...
                </div>
                <div className="w-32 h-[1px] bg-black/5 relative">
                    <div
                        className="absolute top-0 left-0 h-full bg-black/40 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="mt-2 text-black/30 text-[8px] font-light tabular-nums">
                    {Math.round(progress)}%
                </div>
            </div>
        </Html>
    );
}

function Ring({ rotationRef }: { rotationRef: React.MutableRefObject<{ y: number }> }) {
    const { gl, camera } = useThree();
    const { scene: gltfScene } = useGLTF(RING_MODEL);
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

    useEffect(() => {
        if (scene) {
            gl.compile(scene, camera);
        }
    }, [gl, scene, camera]);

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
            className={`w-48 sm:w-56 md:w-64 h-48 sm:h-56 md:h-64 touch-none relative ${className}`}
            style={{ cursor: 'grab' }}
        >
            <Canvas
                camera={{ position: [0, 0, 8], fov: 45 }}
                gl={{
                    alpha: true,
                    antialias: true,
                    powerPreference: "high-performance"
                }}
                shadows
                dpr={[1, 2]}
            >
                <AdaptiveDpr pixelated />
                <ambientLight intensity={1} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={500} castShadow />
                <pointLight position={[-10, -10, -10]} intensity={300} />
                <pointLight position={[5, 5, 5]} intensity={400} />

                <Suspense fallback={<RingLoader />}>
                    <Environment preset="city" />

                    <PresentationControls
                        global={false}
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

useGLTF.preload(RING_MODEL);

