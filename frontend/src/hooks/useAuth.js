/**
 * useAuth Hook
 *
 * Pluggable authentication hook.
 * Replace this implementation to add your own auth logic.
 */
export function useAuth() {
  return {
    isAuthenticated: true,
    user: {
      name: 'User',
      tier: 'free'
    },
    login: () => {},
    logout: () => {}
  }
}
