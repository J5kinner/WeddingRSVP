import { Suspense } from 'react'
import SecureRSVPForm from './components/SecureRSVPForm'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <main className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Wedding RSVP
          </h1>
          <p className="text-lg text-gray-600">
            Please let us know if you&apos;ll be joining us for our special day!
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Submit Your RSVP
          </h2>
          <Suspense fallback={<p className="text-gray-600">Loading form...</p>}>
            <SecureRSVPForm />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
