import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/auth';

export default function PrivateRoute() {
  const { isAuthenticated, authReady } = useAuthStore();

  if (!authReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}
