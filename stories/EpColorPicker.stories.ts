import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpColorPicker.js';

type EpColorPickerArgs = {
  colors: string[];
  value: string;
};

const meta: Meta<EpColorPickerArgs> = {
  title: 'Components/EpColorPicker',
  component: 'ep-color-picker',
  argTypes: {
    colors: { control: 'object' },
    value: { control: 'text' },
  },
  args: {
    colors: ['black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'white', 'cyan'],
    value: '',
  },
};

export default meta;

type Story = StoryObj<EpColorPickerArgs>;

export const Default: Story = {
  render: (args: EpColorPickerArgs) => html`
    <ep-color-picker .colors="${args.colors}" .value="${args.value}"></ep-color-picker>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-color-picker')!;
    await host.updateComplete;
    const swatches = host.shadowRoot!.querySelectorAll('.swatch');
    await expect(swatches.length).toBe(12);
  },
};

export const SelectColor: Story = {
  render: () => html`
    <ep-color-picker .colors="${['red', 'green', 'blue']}"></ep-color-picker>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-color-picker')!;
    await host.updateComplete;
    const handler = fn();
    host.addEventListener('ep-color-select', handler);

    const swatches = host.shadowRoot!.querySelectorAll('.swatch');
    // Click the second swatch (green)
    await userEvent.click(swatches[1]);

    await expect(handler).toHaveBeenCalledTimes(1);
    await expect(host.value).toBe('green');
  },
};

export const WithPreselection: Story = {
  args: { value: 'blue' },
  render: (args: EpColorPickerArgs) => html`
    <ep-color-picker .colors="${args.colors}" .value="${args.value}"></ep-color-picker>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-color-picker')!;
    await host.updateComplete;
    await expect(host.value).toBe('blue');

    const selected = host.shadowRoot!.querySelector('.swatch[aria-selected="true"]');
    await expect(selected).not.toBe(null);
    await expect(selected!.getAttribute('aria-label')).toBe('blue');
  },
};

export const FewColors: Story = {
  args: { colors: ['#ff0000', '#00ff00', '#0000ff'] },
  render: (args: EpColorPickerArgs) => html`
    <ep-color-picker .colors="${args.colors}"></ep-color-picker>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-color-picker')!;
    await host.updateComplete;
    const swatches = host.shadowRoot!.querySelectorAll('.swatch');
    await expect(swatches.length).toBe(3);
  },
};
