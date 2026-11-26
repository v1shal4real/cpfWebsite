/**
 * A way down to the inputs on narrow screens, where the headline comes first
 * and the inputs sit below it. From `lg` the inputs are beside the results, so
 * the link is not shown.
 *
 * A real link, so it is announced and behaves as one, but it moves focus
 * itself instead of following the fragment: the address bar carries the
 * shareable projection, and jumping around the page should not change it.
 */

export const INPUTS_ID = 'your-inputs';

export function JumpToInputs() {
  return (
    <a
      href={`#${INPUTS_ID}`}
      onClick={(event) => {
        const target = document.getElementById(INPUTS_ID);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ block: 'start' });
        // Already scrolled; focusing must not scroll a second time.
        target.focus({ preventScroll: true });
      }}
      className="self-start py-1 text-sm font-medium text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent lg:hidden"
    >
      Jump to inputs
    </a>
  );
}
