// @vitest-environment jsdom
import { render, screen, userEvent } from '@/test/dom';
import { describe, expect, it, vi } from 'vitest';
import { INPUTS_ID, JumpToInputs } from './JumpToInputs';

function renderWithTarget() {
  render(
    <>
      <JumpToInputs />
      <aside id={INPUTS_ID} tabIndex={-1} aria-label="Your inputs" />
    </>,
  );
  const target = screen.getByRole('complementary', { name: 'Your inputs' });
  // jsdom does no layout, so it has no scrollIntoView of its own.
  target.scrollIntoView = vi.fn();
  return target;
}

describe('JumpToInputs', () => {
  it('scrolls to the inputs and puts focus there, from the keyboard', async () => {
    const user = userEvent.setup();
    const target = renderWithTarget();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Jump to inputs' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target).toHaveFocus();
  });

  it('leaves the address, which carries the shared projection, as it was', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?age=40');
    renderWithTarget();
    await user.click(screen.getByRole('link', { name: 'Jump to inputs' }));
    expect(window.location.search).toBe('?age=40');
    expect(window.location.hash).toBe('');
  });
});
