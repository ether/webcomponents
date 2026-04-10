import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpButton.js';

type EpButtonArgs = {
  variant: 'default' | 'primary' | 'ghost' | 'icon';
  size: 'small' | 'medium' | 'large';
  disabled: boolean;
};

const meta: Meta<EpButtonArgs> = {
  title: 'Components/EpButton',
  component: 'ep-button',
  argTypes: {
    variant: { control: 'select', options: ['default', 'primary', 'ghost', 'icon'] },
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    disabled: { control: 'boolean' },
  },
  args: {
    variant: 'default',
    size: 'medium',
    disabled: false,
  },
};

export default meta;

type Story = StoryObj<EpButtonArgs>;

async function getButton(canvasElement: HTMLElement) {
  const host = canvasElement.querySelector('ep-button')!;
  await host.updateComplete;
  const button = host.shadowRoot!.querySelector('button')!;
  return { host, button };
}

export const Default: Story = {
  render: (args: EpButtonArgs) => html`
    <ep-button variant="${args.variant}" size="${args.size}" ?disabled="${args.disabled}">
      Button
    </ep-button>
  `,
  play: async ({ canvasElement }) => {
    const { button } = await getButton(canvasElement);
    await expect(button).not.toBe(null);
    await expect(button.disabled).toBe(false);
  },
};

export const Primary: Story = {
  args: { variant: 'primary' },
  render: (args: EpButtonArgs) => html`
    <ep-button variant="${args.variant}">Save changes</ep-button>
  `,
  play: async ({ canvasElement }) => {
    const { button } = await getButton(canvasElement);
    await expect(button).not.toBe(null);
  },
};

export const PrimaryScreamingCase: Story = {
  args: { variant: 'primary' },
  render: (args: EpButtonArgs) => html`
    <ep-button variant="${args.variant}" uppercase>Save changes</ep-button>
  `,
  play: async ({ canvasElement }) => {
    const { button } = await getButton(canvasElement);
    await expect(button).not.toBe(null);
  },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
  render: (args: EpButtonArgs) => html`
    <ep-button variant="${args.variant}">Cancel</ep-button>
  `,
};

export const ClickEvent: Story = {
  render: () => html`
    <ep-button variant="primary" id="click-test">Click me</ep-button>
  `,
  play: async ({ canvasElement }) => {
    const { host, button } = await getButton(canvasElement);
    const handler = fn();
    host.addEventListener('click', handler);

    await userEvent.click(button);
    await expect(handler).toHaveBeenCalledTimes(1);
  },
};

export const AllVariants: Story = {
  render: () => html`
    <div style="display: flex; gap: 12px; align-items: center;">
      <ep-button variant="default">Default</ep-button>
      <ep-button variant="primary">Primary</ep-button>
      <ep-button variant="ghost">Ghost</ep-button>
      <ep-button variant="icon">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
        </svg>
      </ep-button>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('ep-button');
    await expect(buttons.length).toBe(4);
  },
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 12px; align-items: center;">
      <ep-button variant="primary" size="small">Small</ep-button>
      <ep-button variant="primary" size="medium">Medium</ep-button>
      <ep-button variant="primary" size="large">Large</ep-button>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const buttons = canvasElement.querySelectorAll('ep-button');
    await expect(buttons.length).toBe(3);
  },
};

export const Disabled: Story = {
  args: { disabled: true, variant: 'primary' },
  render: (args: EpButtonArgs) => html`
    <ep-button variant="${args.variant}" ?disabled="${args.disabled}">Disabled</ep-button>
  `,
  play: async ({ canvasElement }) => {
    const { button } = await getButton(canvasElement);
    await expect(button.disabled).toBe(true);
  },
};
