import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getUser, homeForRole, isAuthenticated } from "../api/auth";

export default function RequireRole({ roles, children }: { roles?: string[]; children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const role = getUser()?.role;

  if (roles && !roles.includes(role ?? "")) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return <>{children}</>;
}
