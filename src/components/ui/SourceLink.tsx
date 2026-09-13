import { cn } from '@/lib/cn';
import { formatEffectiveDate } from '@/lib/format';
import { source as getSource, type SourceId } from '@/rules';

/**
 * Per-figure source attribution.
 *
 * Every rule parameter the interface shows links back to the published page it
 * was transcribed from. This is the mechanism behind the success criterion
 * "every number rendered can be traced by the user to the rule that produced
 * it", so it is small enough to put next to anything and never omitted.
 *
 * Opens in a new tab, which is announced — the user is mid-projection and
 * should not lose their place.
 */

export interface SourceLinkProps {
  sourceId: SourceId;
  /** `inline` reads as a sentence fragment; `chip` is the compact tag form. */
  variant?: 'inline' | 'chip';
  /** Also show the date the figure was last read off the page. */
  showRetrieved?: boolean;
  className?: string;
}

export function SourceLink({
  sourceId,
  variant = 'inline',
  showRetrieved = false,
  className,
}: SourceLinkProps) {
  const src = getSource(sourceId);

  return (
    <a
      href={src.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex items-center gap-1 text-accent',
        variant === 'chip'
          ? 'rounded-sm border border-line bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium no-underline hover:border-line-strong'
          : 'text-[0.75rem] underline decoration-accent/40 underline-offset-2 hover:decoration-accent',
        className,
      )}
    >
      <span>
        {variant === 'chip' ? src.publisher : `Source: ${src.publisher}, ${src.title}`}
        {showRetrieved ? (
          <span className="text-ink-subtle">
            {' '}
            · checked {formatEffectiveDate(src.retrievedOn)}
          </span>
        ) : null}
      </span>
      <svg
        aria-hidden="true"
        width="10"
        height="10"
        viewBox="0 0 10 10"
        className="shrink-0 opacity-70 group-hover:opacity-100"
      >
        <path
          d="M3.5 1.5h5v5M8.5 1.5 3 7M6.5 8.5h-5v-5"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only-abs">(opens in a new tab)</span>
    </a>
  );
}
