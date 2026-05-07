import { Routes, Route, Navigate } from 'react-router-dom';
import useAuth from './hooks/useAuth';

import Spinner        from './components/Spinner';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar         from './components/Navbar';

import Login              from './pages/Login';
import AdminLogin         from './pages/admin/AdminLogin';
import Dashboard          from './pages/Dashboard';
import AppDetail          from './pages/AppDetail';
import NotFound           from './pages/NotFound';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import FormMapping        from './pages/admin/FormMapping';

// Mill Logbook forms
import EquipmentTemp  from './pages/forms/mill/EquipmentTemp';
import ShreddarOTG    from './pages/forms/mill/ShreddarOTG';
import LubePressure   from './pages/forms/mill/LubePressure';
import MillStoppages  from './pages/forms/mill/MillStoppages';

// Lab Logbook forms
import DSLogbook       from './pages/forms/lab/DSLogbook';
import RSLogbook       from './pages/forms/lab/RSLogbook';
import OpsLogbook      from './pages/forms/lab/OpsLogbook';
import SALogbook       from './pages/forms/lab/SALogbook';
import SyrupLogbook    from './pages/forms/lab/SyrupLogbook';
import StoppageLogbook from './pages/forms/lab/StoppageLogbook';

// Power Logbook forms
import PhPower    from './pages/forms/power/PhPower';
import PhSteam    from './pages/forms/power/PhSteam';
import PhStoppage from './pages/forms/power/PhStoppage';

const App = () => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner fullScreen />;

  return (
    <>
      {user && <Navbar />}
      <Routes>
        {/* Public */}
        <Route path="/login"       element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected – any authenticated user */}
        <Route element={<ProtectedRoute />}>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/apps/:appId"  element={<AppDetail />} />

          {/* Mill Logbook */}
          <Route path="/forms/mill_logbook1"   element={<EquipmentTemp />} />
          <Route path="/forms/mill_logbook2"   element={<ShreddarOTG />} />
          <Route path="/forms/mill_logbook3"   element={<LubePressure />} />
          <Route path="/forms/mill_stoppages"  element={<MillStoppages />} />

          {/* Lab Logbook */}
          <Route path="/forms/ds_logbook"        element={<DSLogbook />} />
          <Route path="/forms/rs_logbook"        element={<RSLogbook />} />
          <Route path="/forms/ops_logbook"       element={<OpsLogbook />} />
          <Route path="/forms/sa_logbook"        element={<SALogbook />} />
          <Route path="/forms/syrp_logbook"      element={<SyrupLogbook />} />
          <Route path="/forms/stoppage_logbook"  element={<StoppageLogbook />} />

          {/* Power Logbook */}
          <Route path="/forms/ph_power"    element={<PhPower />} />
          <Route path="/forms/ph_steam"    element={<PhSteam />} />
          <Route path="/forms/ph_stoppage" element={<PhStoppage />} />
        </Route>

        {/* Protected – admin only */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route path="/admin/employees" element={<EmployeeManagement />} />
          <Route path="/admin/mappings"  element={<FormMapping />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
