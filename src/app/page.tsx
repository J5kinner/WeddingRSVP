import { Suspense } from 'react'
import Image from 'next/image'
import SecureRSVPForm from './components/SecureRSVPForm'
import VideoScrubSection from './components/VideoScrubSection'
import InteractiveRing from '@/components/InteractiveRing'

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="min-h-screen flex flex-col items-center justify-center relative bg-[#6B7D5E] text-[#000000] px-6 text-center pt-24 pb-32">
        <div className="flex flex-col items-center space-y-10 md:space-y-14 max-w-5xl mx-auto">
          {/* Header Text */}
          <div className="space-y-6 md:space-y-6">
            <p className="font-sans text-[14px] md:text-base font-normal leading-[14px] md:leading-normal tracking-normal text-center">
              Together with their families
            </p>
            <h1 className="font-serif text-[clamp(3.5rem,10vw,90px)] font-normal italic leading-[0.85] tracking-normal text-center">
              Olivia <br className="md:hidden" /> & Jonah
            </h1>
          </div>

          {/* Invitation Text */}
          <div className="space-y-8 md:space-y-8">
            <p className="font-sans text-[14px] md:text-lg font-normal leading-[14px] md:leading-relaxed max-w-[300px] md:max-w-none mx-auto opacity-90 text-center">
              invite you to join them in the<br /> celebration of their marriage on
            </p>
            <div className="font-serif text-[28px] md:text-[40px] font-normal not-italic leading-[28px] md:leading-none tracking-normal text-center space-y-1 md:space-y-4">
              <p>Monday, 18th May, 2026</p>
              <p>at 3 o&apos;clock in the afternoon</p>
            </div>
          </div>

          {/* Leaf Decoration */}
          <div className="pt-2 md:pt-4">
            <Image
              src="/leaf.svg"
              alt="Leaf Decoration"
              width={775}
              height={534}
              className="w-32 sm:w-40 md:w-56 h-auto brightness-0"
              priority
            />
          </div>

          {/* Footer Text */}
          <p className="font-sans text-[14px] md:text-lg font-normal leading-[14px] md:leading-relaxed opacity-80 pt-4 md:pt-6 text-center">
            Please find more details below
          </p>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 animate-bounce opacity-50">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 14l-7 7-7-7" />
          </svg>
        </div>
      </section>

      <VideoScrubSection />

      <section id="rsvp" className="min-h-screen flex flex-col bg-white/50 section-spacing border-t border-[color:var(--color-border-subtle)]">
        <div className="content-container">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-3">
              <div className="relative flex items-center justify-center">
                <InteractiveRing />
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl text-[color:var(--color-text-charcoal)]">
                RSVP
              </h2>
              <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]">
                Please let us know if you&apos;ll be joining us for our special day.
              </p>
            </div>

            <div className="mt-8">
              <Suspense fallback={
                <div className="text-center py-8 text-[color:var(--color-text-charcoal)]">
                  Loading form...
                </div>
              }>
                <SecureRSVPForm />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <section id="registry" className="min-h-screen flex flex-col justify-center section-spacing border-t border-[color:var(--color-border-subtle)]">
        <div className="content-container">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl text-[color:var(--color-text-charcoal)]">
                Registry
              </h2>
              <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]">
                Your presence is our present, but if you&apos;d like to give a gift, we are registered here.
              </p>
            </div>

            <div className="w-full max-w-lg mx-auto bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)] p-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-[#000000]/5 rounded-full flex items-center justify-center text-[#000000] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl text-[color:var(--color-text-charcoal)]">
                  MyRegistry.com
                </h3>
                <p className="text-sm text-[color:var(--color-text-charcoal)]">
                  View our wishlist and contribution options.
                </p>
              </div>

              <a
                href="https://www.myregistry.com/giftlist/JonahAndOlivia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 bg-[color:var(--color-botanical-green)] text-white font-medium rounded-[var(--radius-sm)] hover:bg-[color:var(--color-botanical-green)]/90 transition-all shadow-sm hover:shadow-md w-full sm:w-auto"
              >
                Visit Registry
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
