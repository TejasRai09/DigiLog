import { useLocation } from 'react-router-dom';
import { MdFlashOn } from 'react-icons/md';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppFormsHeader from '../../components/AppFormsHeader';
import FormTable from '../../components/FormTable';
import { POWER_DEPT_FORMS } from '../../config/powerDeptRoutes';
import { buildPowerLandingTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';

const PowerLanding = () => {
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);
  const n = POWER_DEPT_FORMS.length;

  return (
    <main className="app-main">
      <AppBreadcrumb items={buildPowerLandingTrail({ appId, appName })} />

      <AppFormsHeader
        name={appName || 'Power Plant Equipment History'}
        description="Select a department to view equipment history cards"
        icon={MdFlashOn}
        color="#D97706"
        className="mb-6"
      />

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">Available departments</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {n} department{n !== 1 ? 's' : ''} available
          </p>
        </div>
        <div className="p-0">
          <FormTable
            forms={POWER_DEPT_FORMS}
            appId={appId}
            returnTo="/power"
            nameColumnHeader="Department"
            emptyMessage="No departments available."
          />
        </div>
      </div>
    </main>
  );
};

export default PowerLanding;
