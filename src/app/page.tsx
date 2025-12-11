import Image from 'next/image'
import { Suspense } from 'react'
import SecureRSVPForm from './components/SecureRSVPForm'

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header Section - Botanical Wreath & Couple's Initials */}
      <header className="section-spacing">
        <div className="content-container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-6">
            {/* Left: Couple's Names */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1">
              <p className="text-3xl sm:text-4xl md:text-5xl font-serif text-[color:var(--color-text-charcoal)]">
                Jonah Skinner
              </p>
              <p className="text-sm sm:text-base uppercase tracking-wider text-[color:var(--color-text-charcoal)]/60 my-2">
                and
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
                Olivia Savage
              </p>
            </div>

            {/* Center: Botanical Wreath / Crest with Date */}
            <div className="flex flex-col items-center order-1 md:order-2 space-y-4">
              <div className="relative flex items-center justify-center">
                <Image
                  src="/wreath.png"
                  alt="Botanical wreath"
                  width={280}
                  height={240}
                  priority
                  className="h-auto w-48 sm:w-56 md:w-64"
                />
                {/* Couple's Initials Overlay - Script Font */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-script text-4xl sm:text-5xl md:text-6xl text-[color:var(--color-botanical-green)]">
                    O & J
                  </span>
                </div>
              </div>
              {/* Wedding Date */}
              <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-[color:var(--color-text-charcoal)] text-center">
                May 18, 2026
              </h1>
            </div>

            {/* Right: Ceremony, Reception & Venue Details */}
            <div className="flex flex-col items-center md:items-end text-center md:text-right space-y-4 order-3">
              {/* Ceremony & Reception */}
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-serif text-[color:var(--color-text-charcoal)]">
                  Ceremony & Reception
                </h3>
                <p className="text-sm sm:text-base text-[color:var(--color-text-charcoal)]/70">
                  Saturday, May 18, 2026
                </p>
              </div>
              
              {/* Venue */}
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
        </div>
      </header>

      {/* Hero / Welcome Section */}
      <section className="section-spacing border-t border-[color:var(--color-border-subtle)]">
        <div className="content-container">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif text-[color:var(--color-text-charcoal)]">
              We&apos;re Getting Married
            </h2>
            <p className="text-base sm:text-lg text-[color:var(--color-text-charcoal)]/80 leading-relaxed">
              We would be honored to have you join us as we celebrate our special day.
              Your presence would make our celebration complete.
            </p>
          </div>
        </div>
      </section>

      {/* RSVP Form Section */}
      <section id="rsvp" className="section-spacing border-t border-[color:var(--color-border-subtle)]">
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
    </div>
  )
}
