import { describe, expect, it, vi } from 'vitest'
import { logoutFromCfAccess } from './useAuth'

describe('logoutFromCfAccess', () => {
  it('redirects to the Cloudflare Access logout endpoint after confirmation', () => {
    const confirm = vi.fn(() => true)
    const assign = vi.fn()

    expect(logoutFromCfAccess(confirm, assign)).toBe(true)
    expect(confirm).toHaveBeenCalledWith(
      'Sign out of Cloudflare Access? This also signs you out of other Access-protected Massing Labs apps.',
    )
    expect(assign).toHaveBeenCalledWith('/cdn-cgi/access/logout')
  })

  it('keeps the current session when confirmation is cancelled', () => {
    const confirm = vi.fn(() => false)
    const assign = vi.fn()

    expect(logoutFromCfAccess(confirm, assign)).toBe(false)
    expect(assign).not.toHaveBeenCalled()
  })
})
