// @vitest-environment jsdom
import { render, screen, userEvent, waitFor } from '@/test/dom';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

const TEXT = 'Interest floor of 4% a year.';

describe('Tooltip', () => {
  it('opens on keyboard focus and describes its trigger', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={TEXT}>Special Account</Tooltip>);
    await user.tab();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent(TEXT);
    expect(screen.getByText('Special Account').closest('[tabindex]')).toHaveAccessibleDescription(TEXT);
  });

  it('dismisses on Escape without moving focus', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={TEXT}>Special Account</Tooltip>);
    await user.tab();
    const trigger = document.activeElement;
    await screen.findByRole('tooltip');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('dismisses on Escape while open from hover', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={TEXT}>Special Account</Tooltip>);
    await user.hover(screen.getByText('Special Account'));
    await screen.findByRole('tooltip');
    await user.keyboard('{Escape}');
    // Still hovered: Escape, not the pointer leaving, closes it.
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('adds no tab stop of its own around a control', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content={TEXT} focusable={false}>
        <button type="button">Info</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole('button', { name: 'Info' })).toHaveFocus();
    await screen.findByRole('tooltip');
  });
});
