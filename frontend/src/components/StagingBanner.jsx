import { isStagingEnv } from '../utils/appEnv';

const BANNER_TEXT =
  'This environment is only for testing. Please use the production URL for business purposes.';

function MarqueeSegment({ prodUrl }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-10">
      <span>{BANNER_TEXT}</span>
      {prodUrl ? (
        <a
          href={prodUrl}
          className="font-bold underline underline-offset-2 hover:text-amber-900"
        >
          Go to production
        </a>
      ) : null}
      <span aria-hidden className="text-amber-800/60">
        •
      </span>
    </span>
  );
}

/**
 * Sliding marquee notice below the header when VITE_APP_ENV=staging.
 * Text scrolls to the right and loops in from the left.
 */
export default function StagingBanner() {
  if (!isStagingEnv()) return null;

  const prodUrl = String(import.meta.env.VITE_PRODUCTION_URL || '').trim();

  const track = (
    <div className="flex shrink-0 items-center">
      <MarqueeSegment prodUrl={prodUrl} />
      <MarqueeSegment prodUrl={prodUrl} />
      <MarqueeSegment prodUrl={prodUrl} />
      <MarqueeSegment prodUrl={prodUrl} />
    </div>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="staging-banner sticky top-16 z-[45] cursor-default overflow-hidden border-b border-amber-600/30 bg-amber-500 py-2 text-xs font-semibold text-amber-950 sm:text-sm"
    >
      <div className="flex w-max animate-staging-marquee">
        {track}
        {track}
      </div>
      <span className="sr-only">
        {BANNER_TEXT}
        {prodUrl ? ` Production: ${prodUrl}` : ''}
      </span>
    </div>
  );
}
