import { Navigate, useParams } from 'react-router-dom';

/** Legacy URLs: /production-house-equipment/:house/:id → /production-house-equipment/:id */
export default function ProductionHouseLegacyRedirect() {
  const { id } = useParams();
  return <Navigate to={`/production-house-equipment/${id}`} replace />;
}
