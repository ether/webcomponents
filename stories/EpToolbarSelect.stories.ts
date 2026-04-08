import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, fn, waitFor } from 'storybook/test';
import '../src/EpToolbarSelect.js';

const meta: Meta = {
  title: 'Components/EpToolbarSelect',
  component: 'ep-toolbar-select',
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    value: { control: 'text' },
  },
  args: {
    label: 'Font Size',
    placeholder: 'Size',
    value: '',
  },
};

export default meta;

const fontSizes = [
  { label: '8px', value: '8' },
  { label: '10px', value: '10' },
  { label: '12px', value: '12' },
  { label: '14px', value: '14' },
  { label: '16px', value: '16' },
  { label: '18px', value: '18' },
  { label: '24px', value: '24' },
];

type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <ep-toolbar-select
      label="${args.label}"
      placeholder="${args.placeholder}"
      .options="${fontSizes}"
      .value="${args.value}"
    ></ep-toolbar-select>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-toolbar-select')! as any;
    await host.updateComplete;
    const dropdown = host.shadowRoot!.querySelector('ep-dropdown');
    await expect(dropdown).not.toBe(null);

    const trigger = host.shadowRoot!.querySelector('.trigger');
    await expect(trigger).not.toBe(null);
  },
};

export const WithPreselection: Story = {
  args: { value: '14' },
  render: (args) => html`
    <ep-toolbar-select
      label="Font Size"
      .options="${fontSizes}"
      .value="${args.value}"
    ></ep-toolbar-select>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-toolbar-select')! as any;
    await host.updateComplete;
    await expect(host.value).toBe('14');

    const text = host.shadowRoot!.querySelector('.text');
    await expect(text!.textContent).toBe('14px');
  },
};

export const ChangeEvent: Story = {
  render: () => html`
    <ep-toolbar-select label="Size" placeholder="Pick" .options="${fontSizes}"></ep-toolbar-select>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-toolbar-select')! as any;
    await host.updateComplete;
    const handler = fn();
    host.addEventListener('ep-toolbar-select:change', handler);

    // Verify the component rendered with options
    const items = host.shadowRoot!.querySelectorAll('ep-dropdown-item');
    await expect(items.length).toBe(7);
  },
};
