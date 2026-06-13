// ===========================================================================
// Next.js Instrumentation — Bootstrap Guards (A-R2)
//
// `register()` runs once when a server runtime is initialized (next dev /
// next start), BEFORE any request is served. It does NOT run during
// `next build`. This is the bootstrap hook where the dev-bypass deployment
// guard fails closed: a real-data environment with dev-bypass auth enabled
// (or with Auth.js request context disabled) will refuse to start.
//
// See src/lib/security/dev-bypass-guard.ts for the guard logic.
// ===========================================================================

export async function register(): Promise<void> {
  const { assertDevBypassGuard } = await import(
    '@/lib/security/dev-bypass-guard'
  );

  // Fail closed: throws DevBypassGuardError in a real-data environment that
  // enables the dev-header bypass or disables the real Auth.js adapter.
  assertDevBypassGuard();
}
