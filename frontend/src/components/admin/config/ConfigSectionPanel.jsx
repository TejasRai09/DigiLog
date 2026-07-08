export default function ConfigSectionPanel({ title, description, children, actions }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="px-4 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  );
}
