import { Suspense } from 'react'
import Image from 'next/image'
import type { Metadata } from 'next'
import SecureRSVPForm from './components/SecureRSVPForm'
import { SpeedInsights } from "@vercel/speed-insights/next"
import LazyCanvasScrubSection from './components/LazyCanvasScrubSection'

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ inviteCode?: string; invitecode?: string }>
}): Promise<Metadata> {
  const params = await searchParams;
  const code = params.inviteCode || params.invitecode;

  const baseUrl = 'https://oliviaandjonah.xyz';
  const ogUrl = new URL('/api/og', baseUrl);

  if (code) {
    ogUrl.searchParams.set('inviteCode', code);
  }

  const title = "Olivia & Jonah - Wedding Invitation";
  const description = "Join us for our wedding celebration on May 18th, 2026. Please RSVP here.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: code ? `${baseUrl}/?inviteCode=${code}` : baseUrl,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: "Olivia & Jonah Wedding Invitation",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl.toString()],
    },
    other: {
      'fb:app_id': '966242223397117',
    },
  }
}

export default function Home() {
  return (
    <div className="flex flex-col">
      <SpeedInsights />
      <section className="min-h-screen flex flex-col items-center justify-center relative bg-[color:var(--color-hero-green)] text-[#000000] px-6 text-center pt-24 pb-32">
        <div className="flex flex-col items-center space-y-10 md:space-y-14 max-w-5xl mx-auto">
          {/* Header Text */}
          <div className="space-y-6 md:space-y-6">
            <p className="font-sans text-[16px] font-normal leading-[16px] tracking-normal text-center">
              Together with their families
            </p>
            <h1 className="font-serif text-[clamp(4.375rem,12.5vw,90px)] font-normal italic leading-[0.85] tracking-normal text-center">
              Olivia <br className="md:hidden" /> & Jonah
            </h1>
          </div>

          {/* Invitation Text */}
          <div className="space-y-8 md:space-y-8">
            <p className="font-sans text-[16px] font-normal leading-[16px] max-w-[300px] md:max-w-none mx-auto opacity-90 text-center">
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
              className="w-16 sm:w-20 md:w-28 h-auto brightness-0"
              priority
            />
          </div>

          {/* Footer Text */}
          <p className="font-sans text-[16px] font-normal leading-[16px] opacity-80 pt-4 md:pt-6 text-center">
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

      <LazyCanvasScrubSection />

      {/* Mobile & Tablet Location Details */}
      <section className="lg:hidden flex flex-col bg-[#F6F2EA] text-[color:var(--color-text-charcoal)] pt-20 pb-0">
        <div className="flex flex-col items-center justify-center text-center px-6">



          <div className="space-y-14 max-w-sm md:max-w-md mx-auto z-10 relative">
            {/* Where */}
            <div className="space-y-4">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">Where</h3>
              <h2 className="font-serif text-[40px] leading-none">Bendooley Estate</h2>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Bendooley+Estate,+3020+Old+Hume+Hwy,+Berrima+NSW+2577"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-lg underline underline-offset-4 decoration-[0.5px] hover:text-[color:var(--color-botanical-green)] transition-colors"
              >
                3020 Old Hume Hwy, Berrima NSW 2577
              </a>
              <div className="text-base leading-relaxed space-y-1 pt-2 opacity-90 font-sans">
                <p>Parking is available for free on-site.</p>
                <p>The ceremony will take place on the</p>
                <p>Homestead Lawn.</p>
                <p>The reception will take place in the Book Barn.</p>
              </div>
            </div>

            {/* When */}
            <div className="space-y-4">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">When</h3>
              <h2 className="font-serif text-[40px] leading-tight">Monday the 18th of May, 2026</h2>
              <div className="text-base leading-relaxed space-y-1 pt-2 opacity-90 font-sans">
                <p>Please arrive at <strong>2:30pm</strong> for a <strong>3:00pm</strong> start.</p>
                <p>The ceremony will be followed by canapes and</p>
                <p>a reception dinner.</p>
              </div>
            </div>

            {/* Dress Code */}
            <div className="space-y-4">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">Dress code</h3>
              <h2 className="font-serif text-[40px]">Cocktail</h2>
            </div>
          </div>
        </div>

        {/* Map Image */}
        <div className="w-full mt-16 relative">
          <Image
            src="/map.png"
            alt="Bendooley Estate Map"
            width={800}
            height={600}
            sizes="(max-width: 768px) 100vw, 800px"
            className="w-full h-auto object-cover"
          />
        </div>
      </section>

      {/* Desktop Location Details */}
      <section className="hidden lg:flex h-screen bg-[#F6F2EA] text-[color:var(--color-text-charcoal)] overflow-hidden">
        {/* Left Side: Text Info */}
        <div className="w-1/2 h-full flex items-center justify-center p-12 relative">
          <div className="space-y-12 max-w-lg mx-auto text-center w-full z-10">
            {/* Where */}
            <div className="space-y-4">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">Where</h3>
              <h2 className="font-serif text-[40px] leading-none">Bendooley Estate</h2>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Bendooley+Estate,+3020+Old+Hume+Hwy,+Berrima+NSW+2577"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-lg underline underline-offset-4 decoration-[0.5px] hover:text-[color:var(--color-botanical-green)] transition-colors"
              >
                3020 Old Hume Hwy, Berrima NSW 2577
              </a>
              <div className="text-base leading-relaxed space-y-1 pt-2 opacity-90 font-sans">
                <p>Parking is available for free on-site.</p>
                <p>The ceremony will take place on the</p>
                <p>Homestead Lawn.</p>
                <p>The reception will take place in the Book Barn.</p>
              </div>
            </div>

            {/* When */}
            <div className="space-y-4">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">When</h3>
              <h2 className="font-serif text-[40px] leading-tight">Monday the 18th of May, 2026</h2>
              <div className="text-base leading-relaxed space-y-1 pt-2 opacity-90 font-sans">
                <p>Please arrive at <strong>2:30pm</strong> for a <strong>3:00pm</strong> start.</p>
                <p>The ceremony will be followed by canapes and</p>
                <p>a reception dinner.</p>
              </div>
            </div>

            {/* Dress Code */}
            <div className="space-y-4">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">Dress code</h3>
              <h2 className="font-serif text-[40px]">Cocktail</h2>
            </div>
          </div>
        </div>

        {/* Right Side: Map Image */}
        <div className="w-1/2 h-full relative">
          <Image
            src="/map.png"
            alt="Bendooley Estate Map"
            fill
            sizes="50vw"
            className="object-cover"
          />
        </div>
      </section>

      <section id="rsvp" className="flex flex-col bg-[#FBF9F5] py-20 lg:py-32">
        <div className="content-container">
          <div className="max-w-3xl mx-auto space-y-12">
            <div className="text-center space-y-6">

            </div>

            <div className="w-full max-w-lg mx-auto">
              <Suspense fallback={
                <div className="bg-white rounded-[var(--radius-md)] p-12 text-center shadow-sm border border-[color:var(--color-border-subtle)]">
                  <div className="text-[color:var(--color-text-charcoal)]">Loading invite...</div>
                </div>
              }>
                <SecureRSVPForm />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <section id="registry" className="flex flex-col justify-center py-20 lg:py-32 bg-[#F6F2EA] border-t border-[color:var(--color-border-subtle)]">
        <div className="content-container">
          <div className="max-w-3xl mx-auto space-y-12">
            <div className="text-center space-y-6">
              <h3 className="font-sans text-base tracking-wide uppercase opacity-80">Registry</h3>
              <h2 className="font-serif text-[clamp(2rem,5vw,40px)] leading-[1.2] text-[color:var(--color-text-charcoal)] max-w-2xl mx-auto">
                Your presence is our present, but if you&apos;d like to give a gift, we are registered here:
              </h2>
            </div>

            <div className="w-full max-w-lg mx-auto bg-white rounded-[var(--radius-md)] shadow-sm border border-[color:var(--color-border-light)] p-8 text-center space-y-8">
              <div className="space-y-2">
                <div className="mx-auto w-12 h-12 bg-[#000000]/5 rounded-full flex items-center justify-center text-[#000000] mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                </div>
                <h3 className="font-serif text-2xl text-[color:var(--color-text-charcoal)]">
                  MyRegistry.com
                </h3>
              </div>

              <a
                href="https://www.myregistry.com/giftlist/JonahAndOlivia"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 bg-[color:var(--color-botanical-green)] text-white font-medium rounded-[var(--radius-sm)] hover:bg-[#3d563f] transition-all shadow-sm hover:shadow-md w-full"
              >
                Visit Registry
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
