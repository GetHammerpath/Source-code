import { ReactNode } from "react";
import { AdminRouteGuard } from "./AdminRouteGuard";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  return (
    <AdminRouteGuard>
      {children}
    </AdminRouteGuard>
  );
};
