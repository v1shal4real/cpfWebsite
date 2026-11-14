export type CopyStatus = 'idle' | 'copied' | 'failed';

/** What the live region announces, and what the button reads, for each status. */
export const COPY_MESSAGES: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Link copied to clipboard.',
  failed: 'Could not copy automatically. Select the link below and copy it.',
};
