'use client'

import { useEffect, useMemo, useState } from 'react'
import { csrfProtector } from '@/lib/csrf'
import { sanitizeHTML } from '@/lib/security'

interface ImportResult {
  name: string
  status: 'success' | 'error'
  message?: string
}

export default function AdminCsvImport() {
  const [csrfToken, setCsrfToken] = useState<string>('')
  const [fileName, setFileName] = useState<string>('')
  const [names, setNames] = useState<string[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const generateToken = async () => {
      try {
        const { token } = await csrfProtector.generateToken()
        setCsrfToken(token)
      } catch (err) {
        console.error('Failed to generate CSRF token:', err)
        const fallbackToken = Math.random().toString(36).substring(2) + Date.now().toString(36)
        setCsrfToken(fallbackToken)
      }
    }

    generateToken()
  }, [])

  const parsedCount = useMemo(() => names.length, [names])
  const successCount = useMemo(() => results.filter((r) => r.status === 'success').length, [results])
  const errorCount = useMemo(() => results.filter((r) => r.status === 'error').length, [results])
  const progress = parsedCount === 0 ? 0 : Math.round((results.length / parsedCount) * 100)

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const extracted = lines
      .map((line) => line.split(',')[0]?.trim() || '')
      .filter(Boolean)
      .filter((line) => line.toLowerCase() !== 'name')

    const uniqueNames = Array.from(new Set(extracted))
    setNames(uniqueNames)
    setResults([])
    setError('')
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)

    try {
      const text = await file.text()
      parseCsv(text)
    } catch (err) {
      console.error('Failed to read file', err)
      setError('Could not read the selected file.')
    }
  }

  const importGuests = async () => {
    if (!csrfToken) {
      setError('CSRF token not ready yet. Please wait a moment and try again.')
      return
    }

    if (names.length === 0) {
      setError('No names parsed. Please upload a CSV with at least one name.')
      return
    }

    setIsImporting(true)
    setResults([])
    setError('')

    const newResults: ImportResult[] = []

    for (const name of names) {
      try {
        const response = await fetch('/api/rsvp', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken
          },
          body: JSON.stringify({
            name,
            attending: false,
            dietaryNotes: '',
            message: '',
            additionalGuests: [],
            _csrf: csrfToken
          })
        })

        if (response.ok) {
          newResults.push({ name, status: 'success' })
        } else {
          const data = await response.json().catch(() => ({}))
          newResults.push({
            name,
            status: 'error',
            message: typeof data.error === 'string' ? data.error : 'Request failed'
          })
        }
      } catch (err) {
        console.error('Import error for name', name, err)
        newResults.push({ name, status: 'error', message: 'Network error' })
      }

      setResults([...newResults])
    }

    setIsImporting(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Bulk import guests</h2>
          <p className="text-sm text-gray-600 mt-1">Upload a CSV with one name per line (or in the first column).</p>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          className="text-sm text-gray-700"
          aria-label="Upload CSV file"
        />
      </div>

      {fileName && (
        <p className="text-sm text-gray-700">
          File loaded: <span className="font-semibold">{sanitizeHTML(fileName)}</span> ({parsedCount} names)
        </p>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-700">
        <span>Parsed: {parsedCount}</span>
        <span className="text-green-700">Imported: {successCount}</span>
        <span className="text-red-700">Errors: {errorCount}</span>
        <span className="ml-auto">{progress}%</span>
      </div>

      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${progress}%` }}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {error && <p className="text-sm text-red-600">{sanitizeHTML(error)}</p>}

      <button
        type="button"
        onClick={importGuests}
        disabled={isImporting || names.length === 0}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isImporting ? 'Importing...' : 'Start import'}
      </button>

      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Name</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Message</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={`${result.name}-${result.status}-${result.message || ''}`} className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-900">{sanitizeHTML(result.name)}</td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      result.status === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {result.status === 'success' ? 'Created' : 'Error'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {result.message ? sanitizeHTML(result.message) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
