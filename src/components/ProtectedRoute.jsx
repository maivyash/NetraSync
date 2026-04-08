import { Navigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";

/**
 * Protected Route component to ensure user is authenticated
 * Redirects to login if not authenticated
 */
export default function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
