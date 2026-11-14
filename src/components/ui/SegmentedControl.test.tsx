// @vitest-environment jsdom
import { render, screen, userEvent } from '@/test/dom';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

type Plan = 'none' | 'hdb' | 'bank' | 'cash';

const OPTIONS: SegmentedOption<Plan>[] = [
  { value: 'none', label: 'None' },
  { value: 'hdb', label: 'HDB loan' },
  { value: 'bank', label: 'Bank loan' },
  { value: 'cash', label: 'Cash', disabled: true },
];

/** The control is controlled; this holds its value the way a page would. */
function Harness({ initial = 'none' as Plan }) {
  const [value, setValue] = useState<Plan>(initial);
  return (
    <>
      <button type="button">Before</button>
      <SegmentedControl label="Housing plan" options={OPTIONS} value={value} onValueChange={setValue} />
      <button type="button">After</button>
    </>
  );
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('SegmentedControl', () => {
  it('is a labelled radio group with the value checked', () => {
    render(<Harness initial="hdb" />);
    expect(screen.getByRole('radiogroup', { name: 'Housing plan' })).toBeInTheDocument();
    expect(radio('HDB loan')).toBeChecked();
    expect(radio('None')).not.toBeChecked();
  });

  it('puts only the checked option in the tab order', async () => {
    const user = userEvent.setup();
    render(<Harness initial="hdb" />);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(radio('HDB loan')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
  });

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(radio('None'));

    await user.keyboard('{ArrowRight}');
    expect(radio('HDB loan')).toBeChecked();
    expect(radio('HDB loan')).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(radio('Bank loan')).toBeChecked();

    // Past the last enabled option, back to the first.
    await user.keyboard('{ArrowRight}');
    expect(radio('None')).toBeChecked();

    await user.keyboard('{ArrowLeft}');
    expect(radio('Bank loan')).toBeChecked();
    await user.keyboard('{ArrowUp}');
    expect(radio('HDB loan')).toBeChecked();
  });

  it('jumps to the first and last enabled option with Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness initial="hdb" />);
    await user.click(radio('HDB loan'));

    await user.keyboard('{End}');
    expect(radio('Bank loan')).toBeChecked();
    expect(radio('Bank loan')).toHaveFocus();

    await user.keyboard('{Home}');
    expect(radio('None')).toBeChecked();
    expect(radio('None')).toHaveFocus();
  });

  it('never lands on a disabled option', async () => {
    const user = userEvent.setup();
    render(<Harness initial="bank" />);
    await user.click(radio('Bank loan'));
    await user.keyboard('{ArrowRight}{End}');
    expect(radio('Cash')).not.toBeChecked();
    expect(radio('Cash')).toBeDisabled();
  });
});
