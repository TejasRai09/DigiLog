import { useState, useEffect } from 'react';
import DigiLogLoginModal from '../components/DigiLogLoginModal';
import MarketingSiteNav from '../components/marketing/MarketingSiteNav';
import OperationsDeskCard from '../components/marketing/OperationsDeskCard';
import { useOpenLoginFromQuery } from '../hooks/useOpenLoginFromQuery';

/** Public preview of the operations desk (big card) at `/operations-desk`. */
export default function MarketingDashboard() {
  const [loginOpen, setLoginOpen] = useState(false);
  useOpenLoginFromQuery(setLoginOpen);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf9] font-sans text-slate-800 antialiased selection:bg-green-100 selection:text-green-900">
      <DigiLogLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <MarketingSiteNav onLoginClick={() => setLoginOpen(true)} />

      <main className="bg-mesh pb-16 pt-28 lg:pt-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <OperationsDeskCard />
        </div>
      </main>
    </div>
  );
}
