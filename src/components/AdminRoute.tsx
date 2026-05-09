import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";

export function AdminRoute({ children, requireRoles }: { children: React.ReactNode; requireRoles?: AppRole[] }) {
  const { loading, user, isAdmin, roles } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/auth" replace />;
  if (requireRoles && !requireRoles.some((r) => roles.includes(r))) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
