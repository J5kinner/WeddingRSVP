import Image from 'next/image'
import { Suspense } from 'react'
import SecureRSVPForm from './components/SecureRSVPForm'

export default function Home() {
  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 space-y-8 flex flex-col items-center">

      {/* Invitation Card */}
      <header className="w-full max-w-4xl bg-card text-card-foreground rounded-[2rem] shadow-sm border border-border/50 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">

          {/* Left: Names */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1 flex-1">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif text-primary tracking-tight">
              Jonah Skinner
            </h1>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground my-4 font-medium">
              and
            </p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif text-primary tracking-tight">
              Olivia Savage
            </h1>
          </div>

          {/* Center: Wreath & Date */}
          <div className="flex flex-col items-center order-1 md:order-2">
            <div className="relative flex items-center justify-center mb-6">
              <Image
                src="/wreath.png"
                alt="Botanical wreath"
                width={280}
                height={240}
                priority
                className="w-48 sm:w-56 md:w-64 opacity-90"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-script text-5xl sm:text-6xl text-primary/80 pt-4">
                  O & J
                </span>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-serif text-foreground">
              May 18, 2026
            </p>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right space-y-6 order-3 md:order-3 flex-1">
            <div className="space-y-2">
              <h3 className="text-lg font-serif text-primary border-b border-primary/20 pb-1 inline-block">
                Ceremony & Reception
              </h3>
              <p className="text-muted-foreground">
                Saturday, May 18, 2026
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-serif text-primary border-b border-primary/20 pb-1 inline-block">
                Venue
              </h3>
              <p className="text-muted-foreground">
                Bendooley Estate<br />
                Berrima, New South Wales
              </p>
            </div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="mt-12 text-center max-w-2xl mx-auto space-y-4 border-t border-border/50 pt-8">
          <h2 className="text-3xl font-serif text-primary">
            We&apos;re Getting Married
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We would be honored to have you join us as we celebrate our special day.
            Your presence would make our celebration complete.
          </p>
        </div>
      </header>

      {/* RSVP Section */}
      <main className="w-full max-w-2xl">
        <div className="bg-surface-container-low rounded-[2rem] p-8 md:p-12 shadow-sm border border-border/50 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <div className="text-center mb-8 space-y-2">
            <h2 className="text-3xl font-serif text-primary">
              RSVP
            </h2>
            <p className="text-muted-foreground">
              Please let us know if you&apos;ll be joining us.
            </p>
          </div>

          <Suspense fallback={
            <div className="flex justify-center py-12 text-muted-foreground">
              <div className="animate-pulse">Loading RSVP form...</div>
            </div>
          }>
            <SecureRSVPForm />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
