// @vitest-environment jsdom
import { render, screen, userEvent } from '@/test/dom';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

function Harness({ initial = 'chart' }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <button type="button">Before</button>
      <Tabs value={value} onValueChange={setValue}>
        <TabList label="Chart view">
          <Tab value="chart">Chart</Tab>
          <Tab value="table">Table</Tab>
          <Tab value="notes" disabled>
            Notes
          </Tab>
          <Tab value="sources">Sources</Tab>
        </TabList>
        <TabPanel value="chart">Chart panel</TabPanel>
        <TabPanel value="table">Table panel</TabPanel>
        <TabPanel value="sources">Sources panel</TabPanel>
      </Tabs>
    </>
  );
}

const tab = (name: string) => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('links the selected tab to its panel, and renders only that panel', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Chart view' })).toBeInTheDocument();
    expect(tab('Chart')).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Chart' });
    expect(panel).toHaveTextContent('Chart panel');
    expect(tab('Chart')).toHaveAttribute('aria-controls', panel.id);
    expect(screen.queryByText('Table panel')).not.toBeInTheDocument();
  });

  it('puts only the selected tab in the tab order, then the panel', async () => {
    const user = userEvent.setup();
    render(<Harness initial="table" />);
    await user.click(screen.getByRole('button', { name: 'Before' }));
    await user.tab();
    expect(tab('Table')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('moves and selects with the arrow keys, skipping disabled tabs and wrapping', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(tab('Chart'));

    await user.keyboard('{ArrowRight}');
    expect(tab('Table')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Table panel');

    // Notes is disabled: straight on to Sources.
    await user.keyboard('{ArrowRight}');
    expect(tab('Sources')).toHaveFocus();
    expect(tab('Sources')).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(tab('Chart')).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(tab('Sources')).toHaveFocus();
  });

  it('jumps to the first and last tabs with Home and End', async () => {
    const user = userEvent.setup();
    render(<Harness initial="table" />);
    await user.click(tab('Table'));

    await user.keyboard('{End}');
    expect(tab('Sources')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Sources panel');

    await user.keyboard('{Home}');
    expect(tab('Chart')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Chart panel');
  });
});
