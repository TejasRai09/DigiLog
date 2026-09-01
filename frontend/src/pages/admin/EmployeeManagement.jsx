import { Navigate } from 'react-router-dom';

/** @deprecated Use /admin/config?section=employees */
const EmployeeManagement = () => (
  <Navigate to="/admin/config?section=employees" replace />
);

export default EmployeeManagement;
