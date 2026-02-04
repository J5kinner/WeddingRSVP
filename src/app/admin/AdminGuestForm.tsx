'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
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
  const [toast, setToast] = useState<{ message: string; id: number } | null>(null)
  const [mounted, setMounted] = useState(false)

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
    setMounted(true)
  }, [])

  const rawOrigin = mounted && typeof window !== 'undefined' ? window.location.origin : ''
  const origin = rawOrigin.replace(/^https?:\/\/localhost(:\d+)?/, 'https://oliviaandjonah.xyz')

  const copyLink = (code: string) => {
    const link = `${origin}/?inviteCode=${code}`
    navigator.clipboard.writeText(link)
      .then(() => {
        const id = Date.now()
        setToast({ message: 'Link copied to clipboard!', id })
        setTimeout(() => {
          setToast(current => (current?.id === id ? null : current))
        }, 3000)
      })
      .catch(err => console.error('Failed to copy:', err))
  }

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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-4">
          <div>
            <p className="text-sm text-[#000000] mb-1">Invite Created Successfully</p>
            <p className="text-3xl font-mono font-bold text-[#000000] tracking-wider select-all">{createdInviteCode}</p>
          </div>
          <button
            onClick={() => copyLink(createdInviteCode)}
            className="w-full bg-white border border-blue-200 text-blue-600 py-2 px-4 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            Copy Invite Link
          </button>
          <p className="text-xs text-[#000000]">Share this link with guests to RSVP</p>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-8 left-1/2 z-50 pointer-events-none"
          >
            <div className="bg-gray-900/95 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 ring-1 ring-black/5">
              <div className="bg-green-500 rounded-full p-1 shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-medium text-sm whitespace-nowrap tracking-wide">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
