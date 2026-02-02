'use client'

import { useRef, useEffect, useState } from 'react'
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion'

export default function VideoScrubSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoDuration, setVideoDuration] = useState(0)

    const [isMobile, setIsMobile] = useState(false)
    const [hqVideoUrl, setHqVideoUrl] = useState<string | null>(null)

    // Defer HQ download until idle to prevent bandwidth contention
    const [canStartHqDownload, setCanStartHqDownload] = useState(false)
    const downloadTimer = useRef<NodeJS.Timeout>(undefined)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }

        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Reset download state when switching modes (e.g. rotating/resizing)
    useEffect(() => {
        setCanStartHqDownload(false)
        setHqVideoUrl(null)
    }, [isMobile])

    const currentMode = isMobile ? 'mobile' : 'desktop'
    // const baseSrc = isMobile ? "mobile_scrub_opt.mp4" : "web_scrub_opt.mp4"
    const baseSrc = isMobile ? "mob_scrub.mp4" : "web_scrub.mp4"

    const hqSrc = isMobile ? "mob_scrub.mp4" : "web_scrub.mp4"

    // Use the Blob URL if available, otherwise fallback to the optimized version
    const videoSrc = hqVideoUrl || baseSrc

    useEffect(() => {
        // Reset HQ url when mode changes so we don't show wrong video
        setHqVideoUrl(null)

        if (!canStartHqDownload) return

        const controller = new AbortController()

        console.log('Starting download of HQ video:', hqSrc)

        fetch(hqSrc, {
            signal: controller.signal,
            // @ts-ignore - experimental fetch priority
            priority: 'low'
        })
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load ${hqSrc}`)
                return response.blob()
            })
            .then(blob => {
                const url = URL.createObjectURL(blob)
                console.log('HQ video downloaded and ready:', url)
                setHqVideoUrl(url)
            })
            .catch(error => {
                if (error.name !== 'AbortError') {
                    console.error('Error loading HQ video:', error)
                }
            })

        return () => {
            controller.abort()
            // We can't revoke here easily because we don't have the *new* url yet in this closure
            // and we don't want to revoke the one that just got set if we unmount?
            // actually, we should revoke in a separate effect or if we change hqVideoUrl
        }
    }, [hqSrc, canStartHqDownload])

    // Cleanup blob url when it changes or component unmounts
    useEffect(() => {
        return () => {
            if (hqVideoUrl) {
                console.log('Revoking blob URL:', hqVideoUrl)
                URL.revokeObjectURL(hqVideoUrl)
            }
        }
    }, [hqVideoUrl])

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
            console.log('Video loaded:', videoRef.current.currentSrc)
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

    // Update target time when duration loads (fixes initial load position)
    useEffect(() => {
        if (videoDuration > 0) {
            const latest = smoothProgress.get()
            const targetTime = latest * videoDuration
            if (Number.isFinite(targetTime)) {
                targetTimeRef.current = targetTime
            }
        }
    }, [videoDuration, smoothProgress])

    useEffect(() => {
        let animationFrameId: number

        const tick = () => {
            // Removed readyState check to fix "stuck" frames. We want to update currentTime even if buffering.
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
                    autoPlay
                    preload="auto"
                    onLoadedMetadata={handleLoadedMetadata}
                    onPlaying={() => {
                        if (videoRef.current) videoRef.current.pause()
                    }}
                    onCanPlay={() => {
                        // Start idle timer when video can play (initial load)
                        clearTimeout(downloadTimer.current)
                        downloadTimer.current = setTimeout(() => setCanStartHqDownload(true), 2000)
                    }}
                    onSeeking={() => {
                        isSeeking.current = true
                        // Cancel download start if user starts interacting
                        clearTimeout(downloadTimer.current)
                    }}
                    onSeeked={() => {
                        isSeeking.current = false
                        // Restart idle timer when user stops interacting
                        clearTimeout(downloadTimer.current)
                        downloadTimer.current = setTimeout(() => setCanStartHqDownload(true), 2000)
                    }}
                    key={currentMode}
                    src={hqVideoUrl || undefined} // Only set direct src when hq is ready
                >
                    {!hqVideoUrl && (
                        <>
                            <source
                                src=" web_scrub.mp4"
                                media="(min-width: 768px)"
                                type="video/mp4"
                            />
                            <source
                                src=" mob_scrub.mp4"
                                media="(max-width: 767px)"
                                type="video/mp4"
                            />
                        </>
                    )}
                    Your browser does not support the video tag.
                </video>

                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            </div>
        </div>
    )
}
