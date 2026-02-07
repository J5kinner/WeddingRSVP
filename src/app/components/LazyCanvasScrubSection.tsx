'use client'

import dynamic from 'next/dynamic'

const CanvasScrubSection = dynamic(() => import('./CanvasScrubSection'), {
    ssr: false,
    loading: () => (
        <div className="relative h-[300vh] w-full bg-black">
            <div className="sticky top-0 h-[100dvh] w-full bg-black" />
        </div>
    )
})

export default function LazyCanvasScrubSection() {
    return <CanvasScrubSection />
}
