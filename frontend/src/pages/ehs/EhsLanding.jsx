import { useNavigate } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import FormTable from '../../components/FormTable';

const EHS_FORMS = [
  {
    _id:         'ehs_near_miss',
    formKey:     'ehs_near_miss',
    name:        'Near Miss / Incident / Accident Report',
    description: 'Log workplace near misses, incidents and accidents for investigation',
  },
  {
    _id:         'ehs_accident',
    formKey:     'ehs_accident',
    name:        'Accident Data Register',
    description: 'Record accident details — person, department, type and description',
  },
  {
    _id:         'ehs_water_gwa',
    formKey:     'ehs_water_gwa',
    name:        'Water Dashboard — Ground Water Abstraction',
    description: 'Daily ground water abstraction report (bore well extraction and usage)',
  },
];

const EhsLanding = () => {
  const navigate = useNavigate();

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <MdArrowBack className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="mb-6">
        <h1 className="page-title">EHS — Environment Health &amp; Safety</h1>
        <p className="text-sm text-gray-500 mt-1">
          Incident reporting, accident register and water dashboard
        </p>
      </div>

      <FormTable forms={EHS_FORMS} />
    </main>
  );
};

export default EhsLanding;
