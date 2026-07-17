'use client'

import { InteractiveRing } from '@/components/LazyComponents'

export default function RingCard() {
  return (
    <div className="w-full mx-auto p-6 lg:p-10 bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)]">
      <div className="text-center py-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-center relative z-10">
          <InteractiveRing />
        </div>
        <div className="space-y-3">
          <h3 className="text-3xl font-serif text-[color:var(--color-text-charcoal)]">Thank you</h3>
          <p className="text-[color:var(--color-text-charcoal)] opacity-80 max-w-xs mx-auto leading-relaxed">
            Thank you for celebrating with us.
          </p>
        </div>
      </div>
    </div>
  )
}
