import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/lib/copyText';
import { Button, type ButtonProps } from './Button';
import { LiveRegion } from './Misc';

export type CopyStatus = 'idle' | 'copied' | 'failed';

/** What the live region announces, and what the button reads, for each status. */
export const COPY_MESSAGES: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Link copied to clipboard.',
  failed: 'Could not copy automatically. Select the link below and copy it.',
};

const RESET_AFTER_MS = 2500;

export interface CopyLinkButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** The link to copy. Defaults to the page's current URL at the moment of the click. */
  getUrl?: () => string;
  label?: string;
}

/**
 * Copies a shareable link to the projection.
 *
 * The confirmation goes to a polite live region so screen readers hear it
 * without focus moving. When both clipboard paths fail, the link is shown in
 * a read-only, pre-selected field so it can still be copied by hand.
 */
export function CopyLinkButton({
  getUrl = () => window.location.href,
  label = 'Copy link',
  size = 'sm',
  ...props
}: CopyLinkButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const manualField = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (manualUrl) manualField.current?.select();
  }, [manualUrl]);

  const onClick = async () => {
    const url = getUrl();
    const ok = await copyText(url);
    clearTimeout(timer.current);
    setStatus(ok ? 'copied' : 'failed');
    setManualUrl(ok ? null : url);
    if (ok) timer.current = setTimeout(() => setStatus('idle'), RESET_AFTER_MS);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button size={size} onClick={onClick} {...props}>
        {status === 'copied' ? 'Copied' : label}
      </Button>
      {manualUrl ? (
        <input
          ref={manualField}
          readOnly
          value={manualUrl}
          aria-label="Link to this projection"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full max-w-md rounded-sm border border-line-strong bg-surface px-2 py-1 text-[0.8125rem] text-ink"
        />
      ) : null}
      <LiveRegion>{COPY_MESSAGES[status]}</LiveRegion>
    </div>
  );
}
