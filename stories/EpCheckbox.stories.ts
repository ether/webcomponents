import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpCheckbox.js';

type EpCheckboxArgs = {
  checked: boolean;
  disabled: boolean;
  label: string;
  variant: 'default' | 'retro';
};

const meta: Meta<EpCheckboxArgs> = {
  title: 'Components/EpCheckbox',
  component: 'ep-checkbox',
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
    variant: { control: 'select', options: ['default', 'retro'] },
  },
  args: {
    checked: false,
    disabled: false,
    label: 'Show line numbers',
    variant: 'default',
  },
};

export default meta;

type Story = StoryObj<EpCheckboxArgs>;

export const Default: Story = {
  render: (args: EpCheckboxArgs) => html`
    <ep-checkbox
      ?checked="${args.checked}"
      ?disabled="${args.disabled}"
      variant="${args.variant}"
      label="${args.label}"
    ></ep-checkbox>
  `,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')!;
    await host.updateComplete;
    await expect(host.checked).toBe(false);

    // Click the label text instead of the track (no pointer-events issue)
    const label = host.shadowRoot!.querySelector('.label')!;
    await userEvent.click(label);
    await expect(host.checked).toBe(true);

    await userEvent.click(label);
    await expect(host.checked).toBe(false);
  },
};

export const Toggle: Story = {
  render: () => html`<ep-checkbox label="Toggle me"></ep-checkbox>`,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')!;
    await host.updateComplete;
    const handler = fn();
    host.addEventListener('ep-change', handler);

    const label = host.shadowRoot!.querySelector('.label')!;
    await userEvent.click(label);

    await expect(handler).toHaveBeenCalledTimes(1);
    await expect(host.checked).toBe(true);
  },
};

export const Checked: Story = {
  args: { checked: true, label: 'Auto-save enabled' },
  render: (args: EpCheckboxArgs) => html`
    <ep-checkbox
      ?checked="${args.checked}"
      ?disabled="${args.disabled}"
      variant="${args.variant}"
      label="${args.label}"
    ></ep-checkbox>
  `,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')!;
    await host.updateComplete;
    await expect(host.checked).toBe(true);
  },
};

export const Disabled: Story = {
  args: { disabled: true, label: 'Cannot toggle' },
  render: (args: EpCheckboxArgs) => html`
    <ep-checkbox
      ?checked="${args.checked}"
      ?disabled="${args.disabled}"
      variant="${args.variant}"
      label="${args.label}"
    ></ep-checkbox>
  `,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')!;
    await host.updateComplete;
    // Just verify it stays unchecked — don't click (pointer-events: none)
    await expect(host.checked).toBe(false);
    await expect(host.disabled).toBe(true);
  },
};

export const Retro: Story = {
  args: { variant: 'retro', disabled: false, label: 'Retro label' },
  render: (args: EpCheckboxArgs) => html`
    <ep-checkbox
      ?checked="${args.checked}"
      ?disabled="${args.disabled}"
      variant="${args.variant}"
      label="${args.label}"
    ></ep-checkbox>
  `,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')!;
    await host.updateComplete;
    // Verify initial retro args are wired correctly.
    await expect(host.checked).toBe(false);
    await expect(host.disabled).toBe(false);
  },
};

export const SettingsGroup: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <ep-checkbox label="Show line numbers" checked></ep-checkbox>
      <ep-checkbox label="Enable chat"></ep-checkbox>
      <ep-checkbox label="Show author colors" checked></ep-checkbox>
      <ep-checkbox label="Use monospace font"></ep-checkbox>
    </div>
  `,
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const checkboxes = canvasElement.querySelectorAll('ep-checkbox');
    await expect(checkboxes.length).toBe(4);
  },
};
