'use client'

import { useRef, useEffect, useState } from 'react'
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion'

export default function VideoScrubSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoDuration, setVideoDuration] = useState(0)

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end'],
    })

    const smoothProgress = useSpring(scrollYProgress, {
        mass: 0.1,
        stiffness: 100,
        damping: 20,
        restDelta: 0.001
    })

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setVideoDuration(videoRef.current.duration)
        }
    }

    useEffect(() => {
        if (videoRef.current) {
            if (videoRef.current.readyState >= 1) {
                setVideoDuration(videoRef.current.duration)
            }
        }
    }, [])

    useMotionValueEvent(smoothProgress, 'change', (latest) => {
        if (videoRef.current && videoDuration > 0) {
            const targetTime = latest * videoDuration
            if (Number.isFinite(targetTime)) {
                videoRef.current.currentTime = targetTime
            }
        }
    })

    return (
        <div ref={containerRef} className="relative h-[300vh] w-full bg-black">

            <div className="sticky top-0 h-[100dvh] w-full overflow-hidden flex items-center justify-center">

                {/* playsInline is CRITICAL for iOS to prevent fullscreen */}
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    loop
                    preload="auto"
                    onLoadedMetadata={handleLoadedMetadata}
                >
                    <source src="/Short_clip.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                </video>

                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            </div>
        </div>
    )
}
