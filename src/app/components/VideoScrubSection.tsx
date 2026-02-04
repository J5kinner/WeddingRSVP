'use client'

import { useRef, useEffect, useState } from 'react'
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion'

export default function VideoScrubSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoDuration, setVideoDuration] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [hqVideoUrl, setHqVideoUrl] = useState<string | null>(null)
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

    useEffect(() => {
        setCanStartHqDownload(false)
        setHqVideoUrl(null)
    }, [isMobile])

    const hqSrc = isMobile ? "/mob_scrub.mp4" : "/web_scrub.mp4"

    useEffect(() => {
        setHqVideoUrl(null)

        if (!canStartHqDownload) return

        const controller = new AbortController()

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
                if (controller.signal.aborted) return
                const url = URL.createObjectURL(blob)
                setHqVideoUrl(url)
            })
            .catch(error => {
                // Ignore AbortError and ECONNRESET as they are expected when cancelling large downloads
                if (error.name === 'AbortError' || error.code === 'ECONNRESET') {
                    return
                }
                console.error('Error loading HQ video:', error)
            })

        return () => {
            controller.abort()
        }
    }, [hqSrc, canStartHqDownload])

    useEffect(() => {
        return () => {
            if (hqVideoUrl) {
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
            <div className="sticky top-0 h-[100dvh] w-full overflow-hidden flex items-center justify-center will-change-transform">
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
                        clearTimeout(downloadTimer.current)
                        downloadTimer.current = setTimeout(() => setCanStartHqDownload(true), 2000)
                    }}
                    onSeeking={() => {
                        isSeeking.current = true
                        clearTimeout(downloadTimer.current)
                    }}
                    onSeeked={() => {
                        isSeeking.current = false
                        clearTimeout(downloadTimer.current)
                        downloadTimer.current = setTimeout(() => setCanStartHqDownload(true), 2000)
                    }}
                    key={isMobile ? 'mobile' : 'desktop'}
                    src={hqVideoUrl || undefined}
                >
                    {!hqVideoUrl && (
                        <>
                            <source
                                src="/web_scrub.mp4"
                                media="(min-width: 768px)"
                                type="video/mp4"
                            />
                            <source
                                src="/mob_scrub.mp4"
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

