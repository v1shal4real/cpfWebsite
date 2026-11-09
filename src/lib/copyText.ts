/**
 * Copies text to the clipboard, with a fallback for browsers or contexts
 * (plain http, some embedded webviews) where the async Clipboard API is
 * missing or refuses the write.
 *
 * Order of attempts:
 *   1. navigator.clipboard.writeText
 *   2. a hidden, selected textarea and document.execCommand('copy')
 *
 * Resolves to `true` when one of them succeeded and `false` when neither
 * did; it never throws, so the caller only has to choose which message to show.
 * The environment is a parameter so the fallback path can be tested in node.
 */
export interface CopyEnvironment {
  navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } };
  document?: Document;
}

export async function copyText(
  text: string,
  env: CopyEnvironment = {
    navigator: typeof navigator === 'undefined' ? undefined : navigator,
    document: typeof document === 'undefined' ? undefined : document,
  },
): Promise<boolean> {
  const writeText = env.navigator?.clipboard?.writeText;
  if (writeText) {
    try {
      await writeText.call(env.navigator!.clipboard, text);
      return true;
    } catch {
      // Permission denied or insecure context: fall through to the legacy path.
    }
  }
  return legacyCopy(text, env.document);
}

function legacyCopy(text: string, doc: Document | undefined): boolean {
  if (!doc?.body || typeof doc.execCommand !== 'function') return false;
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off-screen rather than display:none, which cannot be selected.
  area.style.position = 'fixed';
  area.style.top = '-1000px';
  area.style.opacity = '0';
  doc.body.appendChild(area);
  const previousFocus = doc.activeElement as HTMLElement | null;
  try {
    area.select();
    return doc.execCommand('copy');
  } catch {
    return false;
  } finally {
    doc.body.removeChild(area);
    previousFocus?.focus?.();
  }
}
