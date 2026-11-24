// @vitest-environment jsdom
import { render, screen, userEvent } from '@/test/dom';
import { describe, expect, it } from 'vitest';
import { CURRENT_RULE_SET } from '@/rules';
import { DEFAULT_FORM, type FormValues } from './form';
import { InputPanel } from './InputPanel';

function panel(values: Partial<FormValues> = {}) {
  render(
    <InputPanel
      values={{ ...DEFAULT_FORM, ...values }}
      onChange={() => undefined}
      errors={{}}
      rules={CURRENT_RULE_SET}
    />,
  );
}

describe('InputPanel optional sections', () => {
  it('keeps the required fields visible and the optional ones collapsed by default', () => {
    panel();
    expect(screen.getByLabelText(/current age/i)).toBeVisible();
    expect(screen.getByLabelText(/gross monthly salary/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /current cpf balances/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /annual bonus/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/ordinary account/i)).not.toBeInTheDocument();
  });

  it('opens a section that already holds a value, so a shared link never hides an input in use', () => {
    panel({ ordinaryBalance: 40_000 });
    expect(screen.getByRole('button', { name: /current cpf balances/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText(/ordinary account/i)).toBeVisible();
  });

  it('opens on request and lets the visitor close it again', async () => {
    const user = userEvent.setup();
    panel();
    const trigger = screen.getByRole('button', { name: /current cpf balances/i });
    await user.click(trigger);
    // Presence, not visibility: the body animates its height open.
    expect(screen.getByLabelText(/ordinary account/i)).toBeInTheDocument();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
