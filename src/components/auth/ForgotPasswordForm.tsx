import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'

interface ForgotPasswordFormProps {
  onSwitchToLogin: () => void
}

export function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (error: any) {
      setError(error.message || 'An error occurred during password reset')
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-xl text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500">
          <Mail size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
        <p className="text-neutral-400 mb-6">
          We've sent a password reset link to <strong className="text-white">{email}</strong>.
          Please check your email and follow the instructions.
        </p>
        <button
          onClick={onSwitchToLogin}
          className="flex items-center mx-auto text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 shadow-xl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
        <p className="text-neutral-400">Enter your email to receive a reset link</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">
            Email address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            placeholder="Enter your email"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Sending reset link...
            </>
          ) : (
            'Send reset link'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={onSwitchToLogin}
          className="text-neutral-500 hover:text-white text-sm flex items-center mx-auto transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to sign in
        </button>
      </div>
    </div>
  )
}
