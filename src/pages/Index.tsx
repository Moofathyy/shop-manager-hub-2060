import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { loading, user, isAdmin } = useAuth();
  if (loading) return null;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  return <Navigate to="/auth" replace />;
};

export default Index;
