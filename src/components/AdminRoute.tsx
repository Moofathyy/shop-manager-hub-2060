export function AdminRoute({ children }: { children: React.ReactNode; requireRoles?: string[] }) {
  // Auth temporarily disabled — open access to admin dashboard.
  return <>{children}</>;
}
