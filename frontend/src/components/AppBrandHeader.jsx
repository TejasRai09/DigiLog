import { Link } from 'react-router-dom';
import DigiLogBrandMark from './DigiLogBrandMark';

const ZUARI_LOGO_URL =
  'https://www.zuariindustries.in/assets/web/img/logo/zuari_logo.png';

/** DigiLog branding bar (Zuari + DigiLog) for public pages such as email action links. */
export default function AppBrandHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="flex w-full min-h-[3.75rem] items-center gap-2 py-2 sm:min-h-16 sm:gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-2 pl-3 sm:gap-3 sm:pl-4 md:gap-4">
          <a
            href="https://www.zuariindustries.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Zuari Industries"
          >
            <img
              src={ZUARI_LOGO_URL}
              alt="Zuari Industries"
              className="h-8 w-auto max-w-[100px] object-contain object-left sm:h-9 sm:max-w-[140px] md:h-10 md:max-w-[170px]"
              width={190}
              height={44}
            />
          </a>
          <Link
            to="/"
            className="flex min-w-0 shrink items-center rounded-lg py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <DigiLogBrandMark size="md" />
          </Link>
        </div>
      </div>
    </header>
  );
}
