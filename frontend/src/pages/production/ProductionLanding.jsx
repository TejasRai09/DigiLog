import { useLocation } from 'react-router-dom';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import FormTable from '../../components/FormTable';
import AppFormsHeader from '../../components/AppFormsHeader';
import { MdFactory } from 'react-icons/md';
import { buildProductionHubTrail } from '../../utils/breadcrumbTrail';

const PROD_FORMS = [
  {
    _id:         'prod_shift_chemist',
    formKey:     'prod_shift_chemist',
    name:        'Shift Chemist Job Log Book',
    description: 'Log jobs done and pending tasks for each shift chemist',
  },
  {
    _id:         'prod_centrifugal',
    formKey:     'prod_centrifugal',
    name:        'A-Centrifugal Machine Stoppage Log Book',
    description: 'Machine run/stoppage details and thermodynamic parameters per shift',
  },
  {
    _id:         'prod_pan_logbook',
    formKey:     'prod_pan_logbook',
    name:        'Pan Log Book',
    description: 'Boiling operation details by massecuite grade with lab analysis',
  },
  {
    _id:         'prod_decanter',
    formKey:     'prod_decanter',
    name:        'Decanter Log Book',
    description: 'Hourly 1st and 2nd stage decanter readings per shift',
  },
  {
    _id:         'prod_clarification',
    formKey:     'prod_clarification',
    name:        'Clarification Log Book',
    description: 'Hourly juice clarification readings and process parameters',
  },
];

const ProductionLanding = () => {
  const location = useLocation();
  const appId = location.state?.appId;

  return (
    <main className="app-main">
      <AppBreadcrumb items={buildProductionHubTrail()} />

      <AppFormsHeader
        name="Production"
        description="Pan boiling, clarification, decanter and centrifugal shift logs"
        icon={MdFactory}
        color="#d97706"
        className="mb-6"
      />

      <FormTable forms={PROD_FORMS} returnTo="/production" appId={appId} />
    </main>
  );
};

export default ProductionLanding;
