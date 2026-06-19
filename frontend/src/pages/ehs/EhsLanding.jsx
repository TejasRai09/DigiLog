import { useLocation } from 'react-router-dom';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import FormTable from '../../components/FormTable';
import AppFormsHeader from '../../components/AppFormsHeader';
import { MdSecurity } from 'react-icons/md';
import { buildEhsHubTrail } from '../../utils/breadcrumbTrail';

const EHS_FORMS = [
  {
    _id:         'ehs_near_miss',
    formKey:     'ehs_near_miss',
    name:        'Near Miss / Incident / Accident Report',
    description: 'Log workplace near misses, incidents and accidents for investigation',
  },
  {
    _id:         'ehs_water_gwa',
    formKey:     'ehs_water_gwa',
    name:        'Water Dashboard — Ground Water Abstraction',
    description: 'Daily bore well extraction and usage report',
  },
  {
    _id:         'ehs_water_etp',
    formKey:     'ehs_water_etp',
    name:        'Water Dashboard — ETP Working',
    description: 'Effluent Treatment Plant daily quantity and quality report',
  },
  {
    _id:         'ehs_water_cpu',
    formKey:     'ehs_water_cpu',
    name:        'Water Dashboard — CPU Water Recycle',
    description: 'CPU inlet/outlet daily report with quality parameters',
  },
];

const EhsLanding = () => {
  const location = useLocation();
  const appId = location.state?.appId;

  return (
    <main className="app-main">
      <AppBreadcrumb items={buildEhsHubTrail()} />

      <AppFormsHeader
        name="EHS"
        description="Incident reporting, accident register and water dashboard"
        icon={MdSecurity}
        color="#059669"
        className="mb-6"
      />

      <FormTable forms={EHS_FORMS} returnTo="/ehs" appId={appId} />
    </main>
  );
};

export default EhsLanding;
