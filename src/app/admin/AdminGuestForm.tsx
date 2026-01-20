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
      // We are hitting the same API but we need to structure it as a "new invite" request.
      // Since our POST /api/rsvp currently handles "updating" or "creating" based on context,
      // but primarily it was designed for the USER RSVP flow.
      // IMPORTANT: The Admin flow needs a way to create an invite *without* full RSVP details.
      // The current POST /api/rsvp requires valid RSVP data structure.
      // We might need to adjust the API or call it differently.
      // Actually, looking at the previous API code I wrote:
      // It handles "inviteCodeFromBody" check. If missing, it creates new.
      // And it inserts guests.
      // So we can send: { guests: [{ name: "..." }], inviteCode: "" }

      const payload = {
        inviteCode: '', // Empty trigger creation
        guests: validNames.map(name => ({
          name,
          status: 'UNSELECTED', // or null/false based on new schema? 
          // New schema has `isAttending` boolean. `null` is default.
          // API expects GuestUpdate[]: { id?, isAttending, dietaryRequirements }
          // Wait, the API I wrote expects `guests: GuestUpdate[]`.
          // `GuestUpdate` has `id`.
          // If I want to CREATE, the API I wrote in step 52 is heavily biased towards UPDATE (it expects `id` for guests?).
          // Let's re-read the API code I wrote.

          // API `POST`: 
          // "1. Verify Invite Exists" -> if inviteCode provided.
          // IF inviteCode not provided (which is weird for RSVP but okay for creation?):
          // The API returns "Invite code required" at the top of try block!
          // lines 127-129: if (!inviteCode) return error.

          // Ah, I broke the "Create Invite" flow in the API refactor because I optimized for "User RSVPing".
          // I need to fix the API to allow Admin to create invites OR create a separate Admin API.
          // Given the prompt "fix the APIs and UI on both the user form and admin page", I should probably fix the API.
          // But I already marked API as done? No, I marked "RSVP submission endpoint" as done. "Update Admin Invite management endpoints" is pending.
          // So I should probably add an Admin API route or tweak api/rsvp.
          // Creating a dedicated admin route is cleaner. `/api/admin/invites`

        })),
        message: '',
        _csrf: csrfToken
      }

      // Switching strategy: I will create a dedicated admin component/action or use a new API route.
      // Since I am in the middle of editing the component file, I'll point it to `/api/admin/invites`.
      // I will create that route next.

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
        <label className="block text-sm font-medium text-gray-700">Guest Names for this Invite</label>

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
          className="text-sm text-blue-600 font-medium hover:text-blue-800"
        >
          + Add another guest
        </button>

        {formErrors.names && <p className="text-red-600 text-sm">{sanitizeHTML(formErrors.names)}</p>}

        {submitMessage && (
          <div
            className={`p-3 rounded-lg text-sm ${submitStatus === 'success'
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
          {isSubmitting ? 'Creating Invite...' : 'Create Invite'}
        </button>
      </form>

      {createdInviteCode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-sm text-blue-600 mb-1">Invite Created Successfully</p>
          <p className="text-3xl font-mono font-bold text-blue-900 tracking-wider select-all">{createdInviteCode}</p>
          <p className="text-xs text-blue-500 mt-2">Share this code with the guests to RSVP</p>
        </div>
      )}
    </div>
  )
}
