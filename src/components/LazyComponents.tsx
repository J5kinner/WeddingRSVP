'use client'

import dynamic from 'next/dynamic'

export const InteractiveRing = dynamic(() => import('@/components/InteractiveRing'), {
    ssr: false,
    loading: () => (
        <div className="w-48 sm:w-56 md:w-64 h-48 sm:h-56 md:h-64 flex flex-col items-center justify-center">
            <div className="text-black/50 text-[10px] font-medium mb-3 tracking-[0.2em] uppercase whitespace-nowrap">
                loading ring...
            </div>
            <div className="w-32 h-[1px] bg-black/5" />
        </div>
    )
})
