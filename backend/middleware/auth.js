/**
 * Auth Middleware
 *
 * Pluggable authentication and authorization hooks.
 * Replace these implementations to add your own auth logic.
 */

export function requireAuth(req, res, next) {
  next()
}

export function requireTier(minTier) {
  return (req, res, next) => next()
}

export function trackUsage(req, res, next) {
  next()
}
