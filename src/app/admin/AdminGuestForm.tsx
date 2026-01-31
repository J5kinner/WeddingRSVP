'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { csrfProtector } from '@/lib/csrf'
import { sanitizeHTML } from '@/lib/security'

type FormErrors = Partial<Record<'names', string>>

interface FormData {
  guestNames: string[]
}

const defaultData: FormData = {
  guestNames: ['']
}

export default function AdminGuestForm() {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>(defaultData)
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null)
  const [submitMessage, setSubmitMessage] = useState('')
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null)

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

  const handleNameChange = (index: number, value: string) => {
    const newNames = [...formData.guestNames]
    newNames[index] = value
    setFormData({ ...formData, guestNames: newNames })
    setFormErrors({})
  }

  const addGuestField = () => {
    setFormData({ ...formData, guestNames: [...formData.guestNames, ''] })
  }

  const removeGuestField = (index: number) => {
    if (formData.guestNames.length === 1) return
    const newNames = formData.guestNames.filter((_, i) => i !== index)
    setFormData({ ...formData, guestNames: newNames })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const validNames = formData.guestNames.map(n => n.trim()).filter(n => n.length > 0)

    if (validNames.length === 0) {
      setFormErrors({ names: 'At least one guest name is required' })
      return
    }

    setIsSubmitting(true)
    setSubmitStatus(null)
    setSubmitMessage('')
    setCreatedInviteCode(null)

    try {
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        body: JSON.stringify({
          guests: validNames,
          _csrf: csrfToken
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus('success')
        setSubmitMessage(`Invite created! Code: ${data.inviteCode}`)
        setCreatedInviteCode(data.inviteCode)
        setFormData(defaultData)
        router.refresh()
      } else {
        setSubmitStatus('error')
        setSubmitMessage(sanitizeHTML(data.error || 'Unable to create invite.'))
      }
    } catch (error) {
      console.error('Admin create invite error:', error)
      setSubmitStatus('error')
      setSubmitMessage('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm font-medium text-[#000000]">Guest Names for this Invite</label>

        {formData.guestNames.map((name, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder={`Guest ${index + 1}`}
              required={index === 0}
            />
            {formData.guestNames.length > 1 && (
              <button
                type="button"
                onClick={() => removeGuestField(index)}
                className="text-red-500 hover:text-red-700 font-medium px-2"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addGuestField}
          className="text-sm text-[#000000] font-medium hover:underline"
        >
          + Add another guest
        </button>

        {formErrors.names && <p className="text-[#000000] text-sm">{sanitizeHTML(formErrors.names)}</p>}

        {submitMessage && (
          <div
            className={`p-3 rounded-lg text-sm ${submitStatus === 'success'
              ? 'bg-green-50 text-[#000000] border border-green-200'
              : 'bg-red-50 text-[#000000] border border-red-200'
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
          {isSubmitting ? 'Creating Invite...' : 'Create Invite'}
        </button>
      </form>

      {createdInviteCode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-sm text-[#000000] mb-1">Invite Created Successfully</p>
          <p className="text-3xl font-mono font-bold text-[#000000] tracking-wider select-all">{createdInviteCode}</p>
          <p className="text-xs text-[#000000] mt-2">Share this code with the guests to RSVP</p>
        </div>
      )}
    </div>
  )
}
