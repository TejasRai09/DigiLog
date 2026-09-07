import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const ProtectedRoute = ({ requiredRole }) => {
  const { user } = useAuth();

  if (!user) {
    const dest = requiredRole === 'admin' ? '/admin/login' : '/?login=1';
    return <Navigate to={dest} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    if (requiredRole === 'admin') return <Navigate to="/admin/login" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
