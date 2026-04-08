import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, within, fn } from 'storybook/test';
import '../src/EpCheckbox.js';

const meta: Meta = {
  title: 'Components/EpCheckbox',
  component: 'ep-checkbox',
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    label: { control: 'text' },
  },
  args: {
    checked: false,
    disabled: false,
    label: 'Show line numbers',
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <ep-checkbox
      ?checked="${args.checked}"
      ?disabled="${args.disabled}"
      label="${args.label}"
    ></ep-checkbox>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')! as any;
    await host.updateComplete;
    await expect(host.checked).toBe(false);

    const track = host.shadowRoot!.querySelector('.track')!;
    await userEvent.click(track);
    await expect(host.checked).toBe(true);

    await userEvent.click(track);
    await expect(host.checked).toBe(false);
  },
};

export const Toggle: Story = {
  render: () => html`<ep-checkbox label="Toggle me"></ep-checkbox>`,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')! as any;
    await host.updateComplete;
    const handler = fn();
    host.addEventListener('ep-change', handler);

    const track = host.shadowRoot!.querySelector('.track')!;
    await userEvent.click(track);

    await expect(handler).toHaveBeenCalledTimes(1);
    await expect(host.checked).toBe(true);
  },
};

export const Checked: Story = {
  args: { checked: true, label: 'Auto-save enabled' },
  render: (args) => html`
    <ep-checkbox ?checked="${args.checked}" label="${args.label}"></ep-checkbox>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')! as any;
    await host.updateComplete;
    await expect(host.checked).toBe(true);
  },
};

export const Disabled: Story = {
  args: { disabled: true, label: 'Cannot toggle' },
  render: (args) => html`
    <ep-checkbox ?disabled="${args.disabled}" label="${args.label}"></ep-checkbox>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-checkbox')! as any;
    await host.updateComplete;
    const track = host.shadowRoot!.querySelector('.track')!;
    await userEvent.click(track);
    // Should remain unchecked
    await expect(host.checked).toBe(false);
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
  play: async ({ canvasElement }) => {
    const checkboxes = canvasElement.querySelectorAll('ep-checkbox');
    await expect(checkboxes.length).toBe(4);
  },
};
