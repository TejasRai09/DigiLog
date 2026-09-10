/**
 * Full-viewport-width header strip (breadcrumb / title / description)
 * so content aligns to the left of the screen even inside centered `.app-main`.
 */
export default function AppPageHeader({ children, className = '' }) {
  if (children == null) return null;
  return (
    <div
      className={`relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 box-border px-4 sm:px-6 lg:px-8 xl:px-10 ${className}`}
    >
      {children}
    </div>
  );
}
