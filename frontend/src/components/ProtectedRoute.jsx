import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { rememberPostLoginRedirect } from '../utils/postLoginRedirect';

const ProtectedRoute = ({ requiredRole }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    if (requiredRole !== 'admin') {
      rememberPostLoginRedirect(`${location.pathname}${location.search || ''}`);
    }
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
