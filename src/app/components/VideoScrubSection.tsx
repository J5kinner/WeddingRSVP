'use client'

import { useRef, useEffect, useState } from 'react'
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion'

export default function VideoScrubSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoDuration, setVideoDuration] = useState(0)

    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

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



    const isSeeking = useRef(false)
    const targetTimeRef = useRef(0)

    useMotionValueEvent(smoothProgress, 'change', (latest) => {
        if (videoRef.current && videoDuration > 0) {
            const targetTime = latest * videoDuration
            if (Number.isFinite(targetTime)) {
                targetTimeRef.current = targetTime
            }
        }
    })

    useEffect(() => {
        let animationFrameId: number

        const tick = () => {
            if (videoRef.current && !isSeeking.current && Math.abs(videoRef.current.currentTime - targetTimeRef.current) > 0.1) {
                videoRef.current.currentTime = targetTimeRef.current
            }
            animationFrameId = requestAnimationFrame(tick)
        }

        animationFrameId = requestAnimationFrame(tick)

        return () => cancelAnimationFrame(animationFrameId)
    }, [])

    return (
        <div ref={containerRef} className="relative h-[300vh] w-full bg-black">

            {/* Added will-change-transform for hardware acceleration hint */}
            <div className="sticky top-0 h-[100dvh] w-full overflow-hidden flex items-center justify-center will-change-transform">

                {/* playsInline is CRITICAL for iOS to prevent fullscreen */}
                <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                    loop
                    preload="auto"
                    onLoadedMetadata={handleLoadedMetadata}
                    onSeeking={() => { isSeeking.current = true }}
                    onSeeked={() => { isSeeking.current = false }}
                    key={isMobile ? 'mobile' : 'desktop'} // Force re-render on change
                >
                    <source src={isMobile ? "/mob_2.mp4" : "/web_1.mp4"} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>

                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            </div>
        </div>
    )
}
