// @vitest-environment jsdom
import { render, screen } from '@/test/dom';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { MoneyInput, NumericInput } from './Input';

const noop = () => {};

describe('Field', () => {
  it('labels its control', () => {
    render(
      <Field label="Property price">
        <NumericInput value={500_000} onValueChange={noop} />
      </Field>,
    );
    expect(screen.getByRole('spinbutton', { name: 'Property price' })).toBeInTheDocument();
  });

  it('describes the control with its hint', () => {
    render(
      <Field label="Property price" hint="The price in the option to purchase.">
        <NumericInput value={500_000} onValueChange={noop} />
      </Field>,
    );
    const control = screen.getByRole('spinbutton', { name: 'Property price' });
    expect(control).toHaveAccessibleDescription('The price in the option to purchase.');
    expect(control).not.toBeInvalid();
  });

  it('marks the control invalid and adds the error to its description, after the hint', () => {
    render(
      <Field
        label="Downpayment"
        hint="At least 25% of the price."
        error="The downpayment must be at least $125,000."
      >
        <NumericInput value={100_000} onValueChange={noop} />
      </Field>,
    );
    const control = screen.getByRole('spinbutton', { name: 'Downpayment' });
    expect(control).toBeInvalid();
    expect(control).toHaveAccessibleDescription(
      'At least 25% of the price. The downpayment must be at least $125,000.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('The downpayment must be at least $125,000.');
  });

  it('marks a required control, without reading the asterisk as part of the name', () => {
    render(
      <Field label="Current age" required>
        <NumericInput value={30} onValueChange={noop} />
      </Field>,
    );
    const control = screen.getByRole('spinbutton', { name: 'Current age' });
    expect(control).toBeRequired();
  });

  it('keeps a control’s own description, such as its unit, alongside the hint', () => {
    render(
      <Field label="Gross monthly salary" hint="Ordinary Wages only.">
        <MoneyInput value={5_000} onValueChange={noop} />
      </Field>,
    );
    const control = screen.getByRole('spinbutton', { name: 'Gross monthly salary' });
    expect(control).toHaveAccessibleDescription(/Ordinary Wages only\./);
    expect(control).toHaveAccessibleDescription(/Singapore dollars/);
  });

  it('keeps the label for screen readers when it is visually hidden', () => {
    render(
      <Field label="Search" labelHidden>
        <NumericInput value={null} onValueChange={noop} />
      </Field>,
    );
    expect(screen.getByRole('spinbutton', { name: 'Search' })).toBeInTheDocument();
  });

  it('gives each field its own ids', () => {
    render(
      <>
        <Field label="First" hint="Hint one">
          <NumericInput value={1} onValueChange={noop} />
        </Field>
        <Field label="Second" hint="Hint two">
          <NumericInput value={2} onValueChange={noop} />
        </Field>
      </>,
    );
    expect(screen.getByRole('spinbutton', { name: 'First' })).toHaveAccessibleDescription('Hint one');
    expect(screen.getByRole('spinbutton', { name: 'Second' })).toHaveAccessibleDescription('Hint two');
  });
});
