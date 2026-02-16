export type AuthRedirectEvent = 'auth_redirect_start' | 'auth_redirect_success' | 'auth_redirect_error'

type AuthRedirectPayload = {
  source?: string
  flowId?: string
  returnTo?: string
  reason?: string
  hop?: number
}

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void
  plausible?: (eventName: string, options?: { props?: Record<string, unknown> }) => void
}

export function emitAuthRedirectEvent(eventName: AuthRedirectEvent, payload: AuthRedirectPayload = {}) {
  if (typeof window === 'undefined') return

  const details = {
    event: eventName,
    ts: Date.now(),
    ...payload,
  }

  const analyticsWindow = window as AnalyticsWindow

  analyticsWindow.gtag?.('event', eventName, details)
  analyticsWindow.plausible?.(eventName, { props: details })

  window.dispatchEvent(new CustomEvent('trainbetter:auth_redirect', { detail: details }))

  if (import.meta.env.DEV) {
    console.info('[auth-telemetry]', details)
  }
}
