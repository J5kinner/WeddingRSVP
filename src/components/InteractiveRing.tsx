'use client';

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useRef } from 'react';
import * as THREE from 'three';

function SpinnableRingModel() {
    const gltf = useLoader(GLTFLoader, '/ring_model.glb');
    const meshRef = useRef<THREE.Group>(null);
    const isDraggingRef = useRef(false);
    const rotationRef = useRef({ x: 0, y: 0 });
    const previousPointerRef = useRef({ x: 0, y: 0 });
    const autoSpinRef = useRef(true);
    const targetRotationRef = useRef({ x: 0, y: 0 });
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const { pointer } = useThree();

    // Handle rotation based on drag - runs every frame for smooth updates
    useFrame(() => {
        if (meshRef.current) {
            if (isDraggingRef.current) {
                // Calculate delta movement
                const deltaX = pointer.x - previousPointerRef.current.x;
                const deltaY = pointer.y - previousPointerRef.current.y;

                // Update rotation based on drag (directly modify ref for immediate update)
                rotationRef.current.x += deltaY * 3;
                rotationRef.current.y += deltaX * 3;

                previousPointerRef.current = { x: pointer.x, y: pointer.y };

                // Disable auto-spin while dragging
                autoSpinRef.current = false;
            } else if (autoSpinRef.current) {
                // Auto-spin: slowly rotate around Y axis
                rotationRef.current.y += 0.01;
            } else {
                // Smoothly interpolate back to auto-spin rotation
                const lerpFactor = 0.05;
                rotationRef.current.x = THREE.MathUtils.lerp(
                    rotationRef.current.x,
                    targetRotationRef.current.x,
                    lerpFactor
                );
                rotationRef.current.y = THREE.MathUtils.lerp(
                    rotationRef.current.y,
                    targetRotationRef.current.y,
                    lerpFactor
                );

                // Continue auto-spin on Y axis for target
                targetRotationRef.current.y += 0.01;

                // Check if we're close enough to target, then re-enable auto-spin
                const diffX = Math.abs(rotationRef.current.x - targetRotationRef.current.x);
                const diffY = Math.abs(rotationRef.current.y - targetRotationRef.current.y);
                if (diffX < 0.01 && diffY < 0.01) {
                    autoSpinRef.current = true;
                }
            }

            // Apply rotation to the mesh every frame
            meshRef.current.rotation.x = rotationRef.current.x;
            meshRef.current.rotation.y = rotationRef.current.y;
        }
    });

    const handlePointerDown = () => {
        isDraggingRef.current = true;
        previousPointerRef.current = { x: pointer.x, y: pointer.y };

        // Clear any pending timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handlePointerUp = () => {
        isDraggingRef.current = false;

        // Set target rotation to current rotation with X reset to 0
        targetRotationRef.current = {
            x: 0,
            y: rotationRef.current.y
        };
    };

    return (
        <primitive
            ref={meshRef}
            object={gltf.scene}
            scale={5}
            position={[0, 0, 0]}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
        />
    );
}

interface InteractiveRingProps {
    className?: string;
}

export default function InteractiveRing({ className = '' }: InteractiveRingProps) {
    return (
        <div
            className={`w-48 sm:w-56 md:w-64 h-48 sm:h-56 md:h-64 ${className}`}
            style={{ cursor: 'grab' }}
        >
            <Canvas
                camera={{ position: [0, 0, 8], fov: 50 }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={1.2} />
                <pointLight position={[-10, -10, -5]} intensity={0.7} />
                <pointLight position={[0, 10, 0]} intensity={0.5} />
                <SpinnableRingModel />
            </Canvas>
        </div>
    );
}
