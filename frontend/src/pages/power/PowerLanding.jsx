import { useNavigate } from 'react-router-dom';
import { MdChevronRight, MdFlashOn, MdBuild, MdTune, MdArrowBack } from 'react-icons/md';

const DEPTS = [
  {
    key:         'electrical',
    name:        'Electrical',
    description: 'Power plant electrical equipment — turbine, generator, boiler, fans, pumps and drives',
    color:       '#2563EB',
    Icon:        MdFlashOn,
    badge:       'History Cards',
  },
  {
    key:         'instrument',
    name:        'Instrument',
    description: 'Motorized actuators, control valves and instrumentation devices',
    color:       '#0891B2',
    Icon:        MdBuild,
    badge:       'History Cards',
  },
  {
    key:         'instrument2',
    name:        'Instrument II',
    description: 'Control valves, safety valves and regulating devices',
    color:       '#7C3AED',
    Icon:        MdTune,
    badge:       'History Cards',
  },
];

const PowerLanding = () => {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <MdArrowBack className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="mb-8">
        <h1 className="page-title">Power Plant — Equipment History Cards</h1>
        <p className="mt-1 text-sm text-gray-500">Select a department to view equipment</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {DEPTS.map((d) => (
          <button
            key={d.key}
            onClick={() => navigate(`/power/${d.key}`)}
            className="card p-6 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: d.color }}
              >
                <d.Icon className="h-6 w-6" />
              </div>
              <MdChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors mt-1" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{d.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{d.description}</p>
            <div className="flex items-center gap-1.5">
              <span className="badge bg-blue-50 text-blue-700">{d.badge}</span>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
};

export default PowerLanding;
