import { Suspense } from 'react'
import SecureRSVPForm from './components/SecureRSVPForm'
import VideoScrubSection from './components/VideoScrubSection'
import InteractiveRing from '@/components/InteractiveRing'

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="min-h-screen flex flex-col justify-center relative section-spacing">
        <div className="content-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-6">
            <div className="flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
              <p className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
                Olivia Savage
              </p>
              <p className="text-sm sm:text-base uppercase tracking-wider text-[color:var(--color-text-charcoal)]/60 my-2">
                and
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
                Jonah Skinner
              </p>
            </div>

            <div className="flex flex-col items-center order-1 md:order-2 space-y-4">
              <div className="relative flex items-center justify-center">
                <InteractiveRing />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-[color:var(--color-text-charcoal)] text-center">
                May 18, 2026
              </h1>
            </div>

            <div className="flex flex-col items-center md:items-end text-center md:text-right space-y-4 order-3">
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-serif text-[color:var(--color-text-charcoal)]">
                  Ceremony & Reception
                </h3>
                <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]/70">
                  Saturday, May 18, 2026
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-serif text-[color:var(--color-text-charcoal)]">
                  Venue
                </h3>
                <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]/70">
                  Bendooley Estate<br />
                  Berrima, New South Wales
                </p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-4 max-w-2xl mx-auto mt-12 md:mt-24">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
              We&apos;re Getting Married
            </h2>
            <p className="text-base sm:text-lg text-[color:var(--color-text-charcoal)]/80 leading-relaxed">
              We would be honored to have you join us as we celebrate our special day.
              Your presence would make our celebration complete.
            </p>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce text-[color:var(--color-text-charcoal)]/40">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7-7-7" />
          </svg>
        </div>
      </section>

      <VideoScrubSection />

      <section id="rsvp" className="min-h-screen flex flex-col bg-white/50 section-spacing border-t border-[color:var(--color-border-subtle)]">
        <div className="content-container">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
                RSVP
              </h2>
              <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]/70">
                Please let us know if you&apos;ll be joining us for our special day.
              </p>
            </div>

            <div className="mt-8">
              <Suspense fallback={
                <div className="text-center py-8 text-[color:var(--color-text-charcoal)]/60">
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
                Registry
              </h2>
              <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]/70">
                Your presence is our present, but if you&apos;d like to give a gift, we are registered here.
              </p>
            </div>

            <div className="w-full max-w-lg mx-auto bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)] p-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-[color:var(--color-sage)]/10 rounded-full flex items-center justify-center text-[color:var(--color-botanical-green)] mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-serif text-[color:var(--color-text-charcoal)]">
                  MyRegistry.com
                </h3>
                <p className="text-sm text-[color:var(--color-text-charcoal)]/70">
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
