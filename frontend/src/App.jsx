import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import useAuth from './hooks/useAuth';

import Spinner from './components/Spinner';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import StagingBanner from './components/StagingBanner';
import IndustryAppBackground from './components/IndustryAppBackground';

/** Eager: shell / first paint only */
import MarketingLanding from './pages/MarketingLanding';
import AdminLogin from './pages/admin/AdminLogin';
import HomeLanding from './pages/HomeLanding';
import NotFound from './pages/NotFound';

/** Logged-in users at `/` go to dashboard, unless `next` is a same-origin deep link (email CTA). */
function LoggedInHomeRedirect() {
  const [searchParams] = useSearchParams();
  const next = String(searchParams.get('next') || '').trim();
  if (next.startsWith('/') && !next.startsWith('//')) {
    return <Navigate to={next} replace />;
  }
  return <Navigate to="/dashboard" replace />;
}

/** Lazy: heavy pages stay out of the main bundle (and ease Lightsail Vite builds) */
const MarketingDashboard = lazy(() => import('./pages/MarketingDashboard'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BiControlTower = lazy(() => import('./pages/BiControlTower'));
const DistilleryAnalyticsDashboard = lazy(() => import('./pages/bi/DistilleryAnalyticsDashboard'));
const MillingOperationsDashboard = lazy(() => import('./pages/bi/MillingOperationsDashboard'));
const PurchyAnalysisDashboard = lazy(() => import('./pages/bi/PurchyAnalysisDashboard'));
const BrixSamplingDashboard = lazy(() => import('./pages/bi/BrixSamplingDashboard'));
const CentreMaturityDashboard = lazy(() => import('./pages/bi/CentreMaturityDashboard'));
const CanePerformanceDashboard = lazy(() => import('./pages/bi/CanePerformanceDashboard'));
const PowerHouseDashboard = lazy(() => import('./pages/bi/PowerHouseDashboard'));
const ManagementDashboard = lazy(() => import('./pages/bi/ManagementDashboard'));
const AppDetail = lazy(() => import('./pages/AppDetail'));
const EmployeeManagement = lazy(() => import('./pages/admin/EmployeeManagement'));
const AdminConfig = lazy(() => import('./pages/admin/AdminConfig'));
const MaintenanceApprovalResult = lazy(() => import('./pages/MaintenanceApprovalResult'));
const MaintenanceApprovalReview = lazy(() => import('./pages/MaintenanceApprovalReview'));
const MaintenanceApprovals = lazy(() => import('./pages/MaintenanceApprovals'));
const DataIngestionCenter = lazy(() => import('./pages/DataIngestionCenter'));

const EquipmentTemp = lazy(() => import('./pages/forms/mill/EquipmentTemp'));
const ShreddarOTG = lazy(() => import('./pages/forms/mill/ShreddarOTG'));
const LubePressure = lazy(() => import('./pages/forms/mill/LubePressure'));
const MillStoppages = lazy(() => import('./pages/forms/mill/MillStoppages'));

const DSLogbook = lazy(() => import('./pages/forms/lab/DSLogbook'));
const RSLogbook = lazy(() => import('./pages/forms/lab/RSLogbook'));
const OpsLogbook = lazy(() => import('./pages/forms/lab/OpsLogbook'));
const SALogbook = lazy(() => import('./pages/forms/lab/SALogbook'));
const SyrupLogbook = lazy(() => import('./pages/forms/lab/SyrupLogbook'));
const StoppageLogbook = lazy(() => import('./pages/forms/lab/StoppageLogbook'));

const PhPower = lazy(() => import('./pages/forms/power/PhPower'));
const PhSteam = lazy(() => import('./pages/forms/power/PhSteam'));
const PhStoppage = lazy(() => import('./pages/forms/power/PhStoppage'));

const DistilleryOperations = lazy(() => import('./pages/forms/distillery/DistilleryOperations'));

const BrixYardSampling = lazy(() => import('./pages/forms/brix/BrixYardSampling'));
const BrixFieldSampling = lazy(() => import('./pages/forms/brix/BrixFieldSampling'));

const PowerEquipmentDetail = lazy(() => import('./pages/power/PowerEquipmentDetail'));
const PowerPlantEquipmentNew = lazy(() => import('./pages/power/PowerPlantEquipmentNew'));
const SugarHouseEquipmentNew = lazy(() => import('./pages/sugar/SugarHouseEquipmentNew'));
const ProductionHouseEquipment = lazy(() => import('./pages/production/ProductionHouseEquipment'));
const ProductionHouseEquipmentDetail = lazy(() => import('./pages/production/ProductionHouseEquipmentDetail'));
const ProductionHouseLegacyRedirect = lazy(() => import('./pages/production/ProductionHouseLegacyRedirect'));

const EhsLanding = lazy(() => import('./pages/ehs/EhsLanding'));
const EhsNearMiss = lazy(() => import('./pages/forms/ehs/EhsNearMiss'));
const EhsWaterGwa = lazy(() => import('./pages/forms/ehs/EhsWaterGwa'));
const EhsWaterEtp = lazy(() => import('./pages/forms/ehs/EhsWaterEtp'));
const EhsWaterCpu = lazy(() => import('./pages/forms/ehs/EhsWaterCpu'));
const EhsToolboxTalk = lazy(() => import('./pages/forms/ehs/EhsToolboxTalk'));

const ProductionLanding = lazy(() => import('./pages/production/ProductionLanding'));
const ProdShiftChemist = lazy(() => import('./pages/forms/production/ProdShiftChemist'));
const ProdCentrifugal = lazy(() => import('./pages/forms/production/ProdCentrifugal'));
const ProdPanLogbook = lazy(() => import('./pages/forms/production/ProdPanLogbook'));
const ProdDecanter = lazy(() => import('./pages/forms/production/ProdDecanter'));
const ProdClarification = lazy(() => import('./pages/forms/production/ProdClarification'));

const App = () => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner fullScreen />;

  return (
    <>
      {user && <IndustryAppBackground />}
      {user && <Navbar />}
      <StagingBanner />
      {/* z-10 keeps page content above the fixed industry bg; modals must portal to body */}
      <div className={user ? 'relative z-10' : undefined}>
      <Suspense fallback={<Spinner fullScreen />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Navigate to="/?login=1" replace />} />
          <Route path="/dashbaord" element={<Navigate to="/dashboard" replace />} />
          <Route path="/operations-desk" element={<MarketingDashboard />} />
          <Route path="/" element={user ? <LoggedInHomeRedirect /> : <MarketingLanding />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/maintenance-approval/review" element={<MaintenanceApprovalReview />} />
          <Route path="/maintenance-approval/accept" element={<MaintenanceApprovalResult mode="accept" />} />
          <Route path="/maintenance-approval/reject" element={<MaintenanceApprovalResult mode="reject" />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<HomeLanding />} />
            <Route path="/maintenance/approvals" element={<MaintenanceApprovals />} />
            <Route path="/data-upload" element={<DataIngestionCenter />} />
            <Route path="/forms-hub" element={<Dashboard />} />
            <Route path="/bi" element={<BiControlTower />} />
            <Route path="/bi/distillery-operations" element={<DistilleryAnalyticsDashboard />} />
            <Route path="/bi/milling-operations" element={<MillingOperationsDashboard />} />
            <Route path="/bi/purchy-analysis" element={<PurchyAnalysisDashboard />} />
            <Route path="/bi/brix-sampling" element={<BrixSamplingDashboard />} />
            <Route path="/bi/centre-maturity" element={<CentreMaturityDashboard />} />
            <Route path="/bi/cane-performance" element={<CanePerformanceDashboard />} />
            <Route path="/bi/power-house" element={<PowerHouseDashboard />} />
            <Route path="/bi/management-dashboard" element={<ManagementDashboard />} />
            <Route path="/apps/:appId" element={<AppDetail />} />

            {/* Mill Logbook */}
            <Route path="/forms/mill_logbook1" element={<EquipmentTemp />} />
            <Route path="/forms/mill_logbook2" element={<ShreddarOTG />} />
            <Route path="/forms/mill_logbook3" element={<LubePressure />} />
            <Route path="/forms/mill_stoppages" element={<MillStoppages />} />

            {/* Lab Logbook */}
            <Route path="/forms/ds_logbook" element={<DSLogbook />} />
            <Route path="/forms/rs_logbook" element={<RSLogbook />} />
            <Route path="/forms/ops_logbook" element={<OpsLogbook />} />
            <Route path="/forms/sa_logbook" element={<SALogbook />} />
            <Route path="/forms/syrp_logbook" element={<SyrupLogbook />} />
            <Route path="/forms/stoppage_logbook" element={<StoppageLogbook />} />

            {/* Power Logbook */}
            <Route path="/forms/ph_power" element={<PhPower />} />
            <Route path="/forms/ph_steam" element={<PhSteam />} />
            <Route path="/forms/ph_stoppage" element={<PhStoppage />} />

            {/* Distillery */}
            <Route path="/forms/distillery_ops" element={<DistilleryOperations />} />

            {/* Equipment History Cards — Mill House hub retired */}
            <Route path="/equipment" element={<Navigate to="/forms-hub" replace />} />
            <Route path="/equipment/:id" element={<Navigate to="/forms-hub" replace />} />

            {/* Power Plant Equipment History (old) retired — new hub stays below */}
            <Route path="/power" element={<Navigate to="/forms-hub" replace />} />
            <Route path="/power/:dept" element={<Navigate to="/forms-hub" replace />} />
            <Route path="/power/:dept/:id" element={<Navigate to="/forms-hub" replace />} />
            <Route path="/power-plant-equipment-new" element={<PowerPlantEquipmentNew />} />
            <Route path="/power-plant-equipment-new/:id/:discipline?" element={<PowerEquipmentDetail />} />

            {/* Sugar House Equipment History */}
            <Route path="/sugar-house-equipment-new" element={<SugarHouseEquipmentNew />} />
            <Route path="/sugar-house-equipment-new/:id/:discipline?" element={<PowerEquipmentDetail />} />

            {/* Production House Equipment History */}
            <Route path="/production-house-equipment" element={<ProductionHouseEquipment />} />
            <Route path="/production-house-equipment/:house/:id" element={<ProductionHouseLegacyRedirect />} />
            <Route path="/production-house-equipment/:id" element={<ProductionHouseEquipmentDetail />} />

            {/* EHS Forms */}
            <Route path="/ehs" element={<EhsLanding />} />
            <Route path="/forms/ehs_near_miss" element={<EhsNearMiss />} />
            <Route path="/forms/ehs_water_gwa" element={<EhsWaterGwa />} />
            <Route path="/forms/ehs_water_etp" element={<EhsWaterEtp />} />
            <Route path="/forms/ehs_water_cpu" element={<EhsWaterCpu />} />
            <Route path="/forms/ehs_toolbox_talk" element={<EhsToolboxTalk />} />

            {/* Production Forms */}
            <Route path="/production" element={<ProductionLanding />} />
            <Route path="/forms/prod_shift_chemist" element={<ProdShiftChemist />} />
            <Route path="/forms/prod_centrifugal" element={<ProdCentrifugal />} />
            <Route path="/forms/prod_pan_logbook" element={<ProdPanLogbook />} />
            <Route path="/forms/prod_decanter" element={<ProdDecanter />} />
            <Route path="/forms/prod_clarification" element={<ProdClarification />} />

            {/* Brix Sampling Forms */}
            <Route path="/forms/brix_yard_sampling" element={<BrixYardSampling />} />
            <Route path="/forms/brix_field_sampling" element={<BrixFieldSampling />} />
          </Route>

          {/* Protected – admin only */}
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin/employees" element={<EmployeeManagement />} />
            <Route path="/admin/config" element={<AdminConfig />} />
            <Route path="/admin/mappings" element={<Navigate to="/admin/config?section=employees" replace />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </div>
    </>
  );
};

export default App;
