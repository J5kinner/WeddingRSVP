'use client'

import { useRef, useEffect, useState } from 'react'
import { useScroll, useSpring, useMotionValueEvent } from 'framer-motion'

interface FrameConfig {
    folder: string
    count: number
    label: string
}

const FRAME_CONFIGS: Record<string, FrameConfig> = {
    mobile: { folder: '/frames_mobile/frame', count: 334, label: 'Mobile Quality' },
    tablet: { folder: '/frames_tablet/frame', count: 830, label: 'Tablet Quality' },
    desktop: { folder: '/frames_desktop/frame', count: 830, label: 'Desktop Quality' }
}

function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1024
}

function hasSlowConnection(): boolean {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
        return false
    }

    const connection = (navigator as Navigator & {
        connection?: {
            saveData: boolean;
            effectiveType: string;
            downlink: number;
        }
    }).connection
    if (!connection) return false

    // Check for slow connection indicators
    if (connection.saveData) return true
    if (connection.effectiveType && ['slow-2g', '2g', '3g'].includes(connection.effectiveType)) return true
    if (connection.downlink && connection.downlink < 1.5) return true

    return false
}

function getFrameConfig(): FrameConfig {
    const isMobile = isMobileDevice()

    if (isMobile) {
        // Use low quality on mobile with slow connection
        const slowConnection = hasSlowConnection()
        if (slowConnection) {
            return FRAME_CONFIGS.mobile
        }
        // Use tablet quality on mobile with fast connection
        return window.innerWidth < 768 ? FRAME_CONFIGS.mobile : FRAME_CONFIGS.tablet
    }

    // Use desktop frames on desktop
    return FRAME_CONFIGS.desktop
}

export default function CanvasScrubSection() {
    const containerRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [imagesLoaded, setImagesLoaded] = useState(0)
    const [isReady, setIsReady] = useState(false)
    const [hasFirstFrame, setHasFirstFrame] = useState(false)
    // Initialize with correct config to avoid double render/fetch on mount
    const [frameConfig, setFrameConfig] = useState<FrameConfig>(() => getFrameConfig())
    const imagesRef = useRef<HTMLImageElement[]>([])
    const currentFrameRef = useRef(0)

    useEffect(() => {
        const config = getFrameConfig()
        if (config.folder !== frameConfig.folder) {
            setFrameConfig(config)
        }


        const handleResize = () => {
            const newConfig = getFrameConfig()
            if (newConfig.folder !== config.folder) {
                setFrameConfig(newConfig)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
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

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const setCanvasSize = () => {
            const dpr = window.devicePixelRatio || 1
            const rect = canvas.getBoundingClientRect()

            canvas.width = rect.width * dpr
            canvas.height = rect.height * dpr

            ctx.scale(dpr, dpr)
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`
        }

        setCanvasSize()
        window.addEventListener('resize', setCanvasSize)

        return () => window.removeEventListener('resize', setCanvasSize)
    }, [])

    useEffect(() => {
        let isCancelled = false
        setImagesLoaded(0)
        setIsReady(false)
        setHasFirstFrame(false)

        const images: HTMLImageElement[] = new Array(frameConfig.count).fill(null)
        let loadedCount = 0
        const totalFrames = frameConfig.count
        const loadedSet = new Set<number>()



        const loadFrame = (index: number): Promise<void> => {
            if (isCancelled || loadedSet.has(index)) return Promise.resolve()

            return new Promise((resolve) => {
                const img = new Image()
                const frameNumber = (index + 1).toString().padStart(4, '0')
                img.src = `${frameConfig.folder}${frameNumber}.webp`

                img.onload = () => {
                    if (isCancelled) return resolve()
                    images[index] = img
                    loadedSet.add(index)
                    loadedCount++
                    setImagesLoaded(loadedCount)

                    if (index === 0) {
                        renderFrame(0)
                        setHasFirstFrame(true)
                    }

                    if (loadedCount === 1 && index !== 0) {
                        renderFrame(0)
                    }

                    resolve()
                }

                img.onerror = () => {
                    if (isCancelled) return resolve()
                    console.error(`Failed to load frame ${frameNumber}`)
                    loadedCount++
                    setImagesLoaded(loadedCount)
                    resolve()
                }
            })
        }

        const loadProgressively = async () => {
            if (isCancelled) return

            // Calculate step for ~12fps equivalent
            const initialStep = Math.max(1, Math.floor(totalFrames / 40))



            // Phase 1: Load every Nth frame for initial 12fps-like experience
            const phase1Promises: Promise<void>[] = []
            for (let i = 0; i < totalFrames; i += initialStep) {
                if (isCancelled) break
                phase1Promises.push(loadFrame(i))
            }

            await Promise.all(phase1Promises)
            if (isCancelled) return

            setIsReady(true)

            // Phase 2: Fill in half the gaps
            const step2 = Math.max(1, Math.floor(initialStep / 2))

            const phase2Promises: Promise<void>[] = []
            for (let i = 0; i < totalFrames; i += step2) {
                if (isCancelled) break
                if (!loadedSet.has(i)) {
                    phase2Promises.push(loadFrame(i))
                }
            }
            await Promise.all(phase2Promises)
            if (isCancelled) return


            // Phase 3: Fill in more gaps
            const step3 = Math.max(1, Math.floor(step2 / 2))

            const phase3Promises: Promise<void>[] = []
            for (let i = 0; i < totalFrames; i += step3) {
                if (isCancelled) break
                if (!loadedSet.has(i)) {
                    phase3Promises.push(loadFrame(i))
                }
            }
            await Promise.all(phase3Promises)
            if (isCancelled) return


            // Phase 4: Load all remaining frames with concurrency control

            const CONCURRENCY = 10
            for (let i = 0; i < totalFrames; i += CONCURRENCY) {
                if (isCancelled) break
                const chunk: Promise<void>[] = []
                for (let j = 0; j < CONCURRENCY && i + j < totalFrames; j++) {
                    if (!loadedSet.has(i + j)) {
                        chunk.push(loadFrame(i + j))
                    }
                }
                await Promise.all(chunk)
            }

            if (isCancelled) return

        }

        loadProgressively()
        imagesRef.current = images

        return () => {
            isCancelled = true
            images.forEach(img => {
                if (img) {
                    img.onload = null
                    img.onerror = null
                    img.src = '' // Cancels pending download in many browsers
                }
            })
        }
    }, [frameConfig])

    const renderFrame = (frameIndex: number) => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const img = imagesRef.current[frameIndex]
        if (!img || !img.complete) return

        const canvasWidth = canvas.width / (window.devicePixelRatio || 1)
        const canvasHeight = canvas.height / (window.devicePixelRatio || 1)

        ctx.clearRect(0, 0, canvasWidth, canvasHeight)

        const imgAspect = img.width / img.height
        const canvasAspect = canvasWidth / canvasHeight

        let drawWidth, drawHeight, offsetX, offsetY

        if (imgAspect > canvasAspect) {
            drawHeight = canvasHeight
            drawWidth = drawHeight * imgAspect
            offsetX = (canvasWidth - drawWidth) / 2
            offsetY = 0
        } else {
            drawWidth = canvasWidth
            drawHeight = drawWidth / imgAspect
            offsetX = 0
            offsetY = (canvasHeight - drawHeight) / 2
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
    }

    useMotionValueEvent(smoothProgress, 'change', (latest) => {
        const frameIndex = Math.min(
            Math.floor(latest * frameConfig.count),
            frameConfig.count - 1
        )

        if (frameIndex !== currentFrameRef.current && imagesRef.current[frameIndex]) {
            currentFrameRef.current = frameIndex
            renderFrame(frameIndex)
        }
    })

    useEffect(() => {
        if (isReady) {
            const frameIndex = Math.min(
                Math.floor(smoothProgress.get() * frameConfig.count),
                frameConfig.count - 1
            )
            renderFrame(frameIndex)
        }
    }, [isReady, smoothProgress, frameConfig.count])

    const loadingProgress = Math.round((imagesLoaded / frameConfig.count) * 100)

    return (
        <div ref={containerRef} className="relative h-[300vh] w-full bg-black">
            <div className="sticky top-0 h-[100dvh] w-full overflow-hidden will-change-transform">
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                    style={{ opacity: hasFirstFrame ? 1 : 0 }}
                />

                {/* Subtle Progress Bar */}
                {loadingProgress < 100 && (
                    <div
                        className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none transition-all duration-1000"
                        style={{ opacity: isReady ? 0.7 : 1 }}
                    >
                        <div className="w-40 h-[3px] bg-white/20 backdrop-blur-md rounded-full overflow-hidden border border-white/40">
                            <div
                                className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                                style={{ width: `${loadingProgress}%` }}
                            />
                        </div>
                        <div className="text-[10px] text-white/80 tracking-[0.3em] font-medium uppercase tabular-nums drop-shadow-md">
                            Loading Proposal {loadingProgress}%
                        </div>
                    </div>
                )}

                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
            </div>
        </div>
    )
}
