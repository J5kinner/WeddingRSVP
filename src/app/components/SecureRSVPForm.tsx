'use client'

import { useState, useCallback, useEffect } from 'react'
import { validateRSVPData, sanitizeHTML } from '@/lib/security'
import { csrfProtector } from '@/lib/csrf'

interface FormErrors {
  name?: string;
  email?: string;
  attending?: string;
  numberOfGuests?: string;
  dietaryNotes?: string;
  message?: string;
}

interface FormData {
  name: string;
  email: string;
  attending: boolean;
  numberOfGuests: number;
  dietaryNotes: string;
  message: string;
}

export default function SecureRSVPForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    attending: true,
    numberOfGuests: 1,
    dietaryNotes: '',
    message: '',
  })
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')

  // Generate CSRF token on component mount
  useEffect(() => {
    const generateToken = async () => {
      try {
        const { token } = await csrfProtector.generateToken()
        setCsrfToken(token)
      } catch (error) {
        console.error('Failed to generate CSRF token:', error)
        // Generate a fallback token using a simpler method
        const fallbackToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
        setCsrfToken(fallbackToken)
      }
    }
    
    generateToken()
  }, [])

  // Debounced validation to avoid excessive validation calls
  const validateField = useCallback((fieldName: keyof FormData, value: unknown) => {
    const validationData = { ...formData, [fieldName]: value }
    const result = validateRSVPData(validationData)
    
    const fieldError = result.errors[fieldName]
    setFormErrors(prev => ({
      ...prev,
      [fieldName]: fieldError || ''
    }))
    
    return !fieldError
  }, [formData])

  const handleInputChange = (field: keyof FormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
    
    if (value && (formErrors[field] || value.toString().length > 2)) {
      validateField(field, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationResult = validateRSVPData(formData)
    
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
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          ...validationResult.sanitizedData,
          _csrf: csrfToken
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        setSubmitMessage('Thank you for your RSVP!')
        setFormData({
          name: '',
          email: '',
          attending: true,
          numberOfGuests: 1,
          dietaryNotes: '',
          message: '',
        })
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setSubmitStatus('error')
        setSubmitMessage(sanitizeHTML(data.error || 'Something went wrong. Please try again.'))
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setSubmitStatus('error')
      setSubmitMessage('Failed to submit RSVP. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const attendingOptions = [
    { value: true, label: 'Yes, I\'ll be there!', description: 'We can\'t wait to celebrate with you!' },
    { value: false, label: 'Sorry, can\'t make it', description: 'We understand, but we\'ll miss you!' }
  ]

  const guestOptions = Array.from({ length: 20 }, (_, i) => i + 1)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name Field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Name * <span className="text-xs text-gray-500">(100 character limit)</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => handleInputChange('name', e.target.value)}
          maxLength={100}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
            formErrors.name 
              ? 'border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
          }`}
          placeholder="John & Jane Doe"
        />
        {formErrors.name && (
          <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.name)}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {formData.name.length}/100 characters
        </p>
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email * <span className="text-xs text-gray-500">(255 character limit)</span>
        </label>
        <input
          type="email"
          id="email"
          required
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          maxLength={255}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
            formErrors.email 
              ? 'border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
          }`}
          placeholder="your@email.com"
        />
        {formErrors.email && (
          <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.email)}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {formData.email.length}/255 characters
        </p>
        <p className="text-gray-400 text-xs mt-1">
          Please use your permanent email address
        </p>
      </div>

      {/* Attending Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Will you be attending? *
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {attendingOptions.map((option) => (
            <label
              key={String(option.value)}
              className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                formData.attending === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="attending"
                checked={formData.attending === option.value}
                onChange={() => handleInputChange('attending', option.value)}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">{option.label}</span>
                <p className="text-sm text-gray-600 mt-1">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
        {formErrors.attending && (
          <p className="text-red-600 text-sm mt-2">{sanitizeHTML(formErrors.attending)}</p>
        )}
      </div>

      {/* Conditional Fields for Attending Guests */}
      {formData.attending && (
        <>
          {/* Number of Guests */}
          <div>
            <label htmlFor="numberOfGuests" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Guests *
            </label>
            <select
              id="numberOfGuests"
              value={formData.numberOfGuests}
              onChange={(e) => handleInputChange('numberOfGuests', parseInt(e.target.value))}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                formErrors.numberOfGuests 
                  ? 'border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
              }`}
            >
              {guestOptions.map((num) => (
                <option key={num} value={num}>
                  {num} {num === 1 ? 'guest' : 'guests'}
                </option>
              ))}
            </select>
            {formErrors.numberOfGuests && (
              <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.numberOfGuests)}</p>
            )}
          </div>

          {/* Dietary Restrictions */}
          <div>
            <label htmlFor="dietaryNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Dietary Restrictions or Special Requests <span className="text-xs text-gray-500">(500 character limit)</span>
            </label>
            <textarea
              id="dietaryNotes"
              value={formData.dietaryNotes}
              onChange={(e) => handleInputChange('dietaryNotes', e.target.value)}
              maxLength={500}
              rows={3}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
                formErrors.dietaryNotes 
                  ? 'border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
              }`}
              placeholder="Vegetarian, gluten-free, allergies, etc."
            />
            {formErrors.dietaryNotes && (
              <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.dietaryNotes)}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">
              {formData.dietaryNotes.length}/500 characters
            </p>
          </div>
        </>
      )}

      {/* Message Field */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
          Message <span className="text-xs text-gray-500">(300 character limit, optional)</span>
        </label>
        <textarea
          id="message"
          value={formData.message}
          onChange={(e) => handleInputChange('message', e.target.value)}
          maxLength={300}
          rows={3}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none transition-colors ${
            formErrors.message 
              ? 'border-red-500 focus:ring-red-200' 
              : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
          }`}
          placeholder="We're so excited to celebrate with you!"
        />
        {formErrors.message && (
          <p className="text-red-600 text-sm mt-1">{sanitizeHTML(formErrors.message)}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {formData.message.length}/300 characters
        </p>
      </div>

      {/* Submit Status */}
      {submitMessage && (
        <div
          className={`p-4 rounded-lg ${
            submitStatus === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {sanitizeHTML(submitMessage)}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Submitting...
          </span>
        ) : (
          'Submit Secure RSVP'
        )}
      </button>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          🔒 Your information is secure. We use industry-standard security practices to protect your data.
        </p>
      </div>
    </form>
  )
}