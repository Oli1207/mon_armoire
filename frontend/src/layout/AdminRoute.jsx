import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/auth';

export default function AdminRoute() {
  const { isAuthenticated, authReady, user } = useAuthStore();

  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_staff) return <Navigate to="/" replace />;
  return <Outlet />;
}
