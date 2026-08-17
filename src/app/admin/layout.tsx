// Root shell for all /admin/* routes.
// Auth protection is layered:
//   1. Edge (middleware.ts) — session refresh + admin redirect via updateSession()
//   2. (protected)/layout.tsx — server-component platform_admins check + sidebar UI
// This layout is intentionally a pass-through so /admin/login stays reachable
// for unauthenticated users.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
