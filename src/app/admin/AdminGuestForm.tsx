'use client'

import { useEffect, useState } from 'react'
import { csrfProtector } from '@/lib/csrf'
import { sanitizeHTML, validateRSVPData } from '@/lib/security'

type FormErrors = Partial<Record<'name', string>>

interface FormData {
  name: string
}

const defaultData: FormData = {
  name: ''
}

export default function AdminGuestForm() {
  const [formData, setFormData] = useState<FormData>(defaultData)
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')

  useEffect(() => {
    const generateToken = async () => {
      try {
        const { token } = await csrfProtector.generateToken()
        setCsrfToken(token)
      } catch (error) {
        console.error('Failed to generate CSRF token:', error)
        const fallbackToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
        setCsrfToken(fallbackToken)
      }
    }

    generateToken()
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const validationResult = validateRSVPData({
      ...formData,
      attending: false,
      dietaryNotes: '',
      message: '',
      additionalGuests: []
    })

    if (!validationResult.isValid) {
      setFormErrors(validationResult.errors)
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage('')

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          name: validationResult.sanitizedData.name,
          attending: false,
          dietaryNotes: '',
          message: '',
          additionalGuests: [],
          _csrf: csrfToken
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        setSubmitMessage('Guest added successfully.')
        setFormData(defaultData)
        setFormErrors({})
      } else {
        setSubmitStatus('error')
        setSubmitMessage(sanitizeHTML(data.error || 'Unable to add guest.'))
      }
    } catch (error) {
      console.error('Admin add guest error:', error)
      setSubmitStatus('error')
      setSubmitMessage('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="admin-name">
          Guest name *
        </label>
        <input
          id="admin-name"
          type="text"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value })
            setFormErrors((prev) => ({ ...prev, name: '' }))
          }}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
            formErrors.name
              ? 'border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
          }`}
          maxLength={100}
          placeholder="Guest full name"
          required
        />
        {formErrors.name && <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.name)}</p>}
      </div>

      {submitMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            submitStatus === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {sanitizeHTML(submitMessage)}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Saving...' : 'Add Guest'}
      </button>
    </form>
  )
}
