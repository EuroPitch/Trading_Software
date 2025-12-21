// HomeRoute.tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Auth/Login";

export function HomeRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // or a spinner
  }

  if (session) {
    return <Navigate to="/portfolio" replace />;
  }

  return <Login />;
}
