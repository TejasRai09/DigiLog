import { Navigate, useParams } from 'react-router-dom';
import MaintenanceNotesPage from './maintenanceNotes/MaintenanceNotesPage';

/** Old /forms-hub/operations and /forms-hub/equipment URLs land on Forms Hub sections. */
const FormsHubCategory = () => {
  const { category } = useParams();

  if (category === 'maintenance-notes') {
    return <MaintenanceNotesPage />;
  }
  if (category === 'equipment') {
    return <Navigate to="/forms-hub#equipment" replace />;
  }
  if (category === 'operations') {
    return <Navigate to="/forms-hub#operations" replace />;
  }
  return <Navigate to="/forms-hub" replace />;
};

export default FormsHubCategory;
