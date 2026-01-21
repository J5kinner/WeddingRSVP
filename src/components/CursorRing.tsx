'use client';

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';

function RingModel() {
    const gltf = useLoader(GLTFLoader, '/ring_model.glb');
    const meshRef = useRef<THREE.Group>(null);
    const { viewport, pointer } = useThree();

    // Update ring position to follow cursor
    useFrame(() => {
        if (meshRef.current) {
            // Convert pointer coordinates to world space
            const targetX = pointer.x * viewport.width / 2;
            const targetY = pointer.y * viewport.height / 2;

            // Smooth interpolation for natural movement
            meshRef.current.position.x = THREE.MathUtils.lerp(
                meshRef.current.position.x,
                targetX,
                0.1
            );
            meshRef.current.position.y = THREE.MathUtils.lerp(
                meshRef.current.position.y,
                targetY,
                0.1
            );

            // Optional: Add subtle rotation for visual interest
            meshRef.current.rotation.y += 0.01;
        }
    });

    return (
        <primitive
            ref={meshRef}
            object={gltf.scene}
            scale={0.5}
            position={[0, 0, 0]}
        />
    );
}

interface CursorRingProps {
    className?: string;
}

export default function CursorRing({ className = '' }: CursorRingProps) {
    return (
        <div
            className={`w-full h-full ${className}`}
            style={{ cursor: 'none' }}
        >
            <Canvas
                camera={{ position: [0, 0, 8], fov: 50 }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} />
                <RingModel />
            </Canvas>
        </div>
    );
}
