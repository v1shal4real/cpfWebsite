// @vitest-environment jsdom
import { render, screen, userEvent } from '@/test/dom';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { NumericInput } from './Input';

/** Holds the value, and shows it, so tests can read what the page would receive. */
function Harness({ initial = null as number | null, min = 10, max = 1_000_000, step = 1_000 }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <label htmlFor="price">Price</label>
      <NumericInput id="price" value={value} onValueChange={setValue} min={min} max={max} step={step} />
      <output data-testid="value">{value === null ? 'null' : String(value)}</output>
      <button type="button">Elsewhere</button>
    </>
  );
}

const input = () => screen.getByRole('spinbutton', { name: 'Price' });
const value = () => screen.getByTestId('value').textContent;

describe('NumericInput', () => {
  describe('parsing', () => {
    it('reads a plain number as the user types', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.type(input(), '450000');
      expect(value()).toBe('450000');
    });

    it('ignores thousands separators, spaces and underscores', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.type(input(), '1,250 000_5');
      expect(value()).toBe('12500005');
    });

    it('reads an emptied field, or a lone minus, as empty', async () => {
      const user = userEvent.setup();
      render(<Harness initial={5_000} min={-100} />);
      await user.clear(input());
      expect(value()).toBe('null');
      await user.type(input(), '-');
      expect(value()).toBe('null');
    });

    it('keeps the last good value while the text is not a number', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.type(input(), '12abc');
      expect(value()).toBe('12');
      expect(input()).toHaveValue('12abc');
    });

    it('shows the raw text while focused and groups digits on blur', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.type(input(), '450000');
      expect(input()).toHaveValue('450000');
      await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
      expect(input()).toHaveValue('450,000');
    });
  });

  describe('clamping', () => {
    it('does not fight typing on the way past the minimum', async () => {
      const user = userEvent.setup();
      render(<Harness min={10} />);
      await user.type(input(), '1');
      expect(value()).toBe('1');
      await user.type(input(), '00');
      expect(value()).toBe('100');
    });

    it('clamps to the minimum and maximum on leaving the field', async () => {
      const user = userEvent.setup();
      render(<Harness min={10} max={500} />);
      await user.type(input(), '3');
      await user.tab();
      expect(value()).toBe('10');

      await user.clear(input());
      await user.type(input(), '9999');
      await user.tab();
      expect(value()).toBe('500');
    });

    it('leaves an empty field empty on blur', async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(input());
      await user.tab();
      expect(value()).toBe('null');
    });
  });

  describe('arrow keys', () => {
    it('step up and down by the step', async () => {
      const user = userEvent.setup();
      render(<Harness initial={5_000} />);
      await user.click(input());
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(value()).toBe('7000');
      await user.keyboard('{ArrowDown}');
      expect(value()).toBe('6000');
      expect(input()).toHaveValue('6000');
    });

    it('stop at the minimum and maximum', async () => {
      const user = userEvent.setup();
      render(<Harness initial={1_500} min={1_000} max={2_000} step={1_000} />);
      await user.click(input());
      await user.keyboard('{ArrowUp}');
      expect(value()).toBe('2000');
      await user.keyboard('{ArrowDown}{ArrowDown}');
      expect(value()).toBe('1000');
    });

    it('start from the minimum when the field is empty', async () => {
      const user = userEvent.setup();
      render(<Harness min={10} step={5} />);
      await user.click(input());
      await user.keyboard('{ArrowUp}');
      expect(value()).toBe('15');
    });

    it('report the value to assistive tech', async () => {
      const user = userEvent.setup();
      render(<Harness initial={5_000} />);
      await user.click(input());
      await user.keyboard('{ArrowUp}');
      expect(input()).toHaveAttribute('aria-valuenow', '6000');
      expect(input()).toHaveAttribute('aria-valuemin', '10');
    });
  });
});
