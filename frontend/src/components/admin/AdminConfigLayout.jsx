import { MdSettings } from 'react-icons/md';
import { ADMIN_CONFIG_SECTIONS } from './config/adminConfigSections';

export default function AdminConfigLayout({ activeSectionId, onSectionChange, children }) {
  return (
    <main className="app-main">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MdSettings className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="page-title">Config</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Employees, categories, BI settings, and other portal configuration.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav
          className="card h-fit p-2 lg:sticky lg:top-24"
          aria-label="Config sections"
        >
          <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Settings
          </p>
          <ul className="space-y-1">
            {ADMIN_CONFIG_SECTIONS.map(({ id, label, description, Icon, disabled, comingSoon }) => {
              const active = id === activeSectionId;
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && onSectionChange(id)}
                    className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                        : disabled
                          ? 'cursor-not-allowed text-gray-400'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {Icon ? (
                      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                    ) : null}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{label}</span>
                      {description ? (
                        <span className="mt-0.5 block text-xs leading-snug text-gray-500">
                          {comingSoon ? 'Coming soon' : description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </main>
  );
}
