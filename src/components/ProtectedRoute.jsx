import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading, isAuthenticated } = useAuth();

  console.log("🛡️ ProtectedRoute - Current state:", {
    loading,
    isAuthenticated,
    user: user?.username,
    userRole: user?.role,
    userType: user?.user_type,
    requiredRole
  });

  if (loading) {
    console.log("🛡️ ProtectedRoute - Still loading...");
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    console.log("🛡️ ProtectedRoute - NOT authenticated, redirecting to login");
    return <Navigate to="/" replace />;
  }

  // Role checking logic
  if (requiredRole) {
    const userRole = user.role?.toLowerCase();
    const requiredRoleNormalized = requiredRole.toLowerCase();

    console.log("🛡️ ProtectedRoute - Role check:", {
      userRole,
      requiredRole: requiredRoleNormalized,
      user: user.username,
      userType: user.user_type,
    });

    if (userRole !== requiredRoleNormalized) {
      console.log("🛡️ ProtectedRoute - Role mismatch, redirecting...");
      // Redirect based on role
      if (userRole === "inspector") {
        return <Navigate to="/inspector" replace />;
      }
      if (userRole === "admin") {
        return <Navigate to="/admin" replace />;
      }
      if (userRole === "employee") {
        return <Navigate to="/employee" replace />;
      }

      return <Navigate to="/" replace />;
    }
  }

  console.log("🛡️ ProtectedRoute - Access granted!");
  return children;
};

export default ProtectedRoute;