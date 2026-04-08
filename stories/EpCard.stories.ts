import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect } from 'storybook/test';
import '../src/EpCard.js';
import '../src/EpButton.js';

const meta: Meta = {
  title: 'Components/EpCard',
  component: 'ep-card',
  argTypes: {
    cardTitle: { control: 'text' },
    subtitle: { control: 'text' },
    bordered: { control: 'boolean' },
    compact: { control: 'boolean' },
  },
  args: {
    cardTitle: 'Pad Settings',
    subtitle: 'Configure your pad preferences',
    bordered: false,
    compact: false,
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <ep-card card-title="${args.cardTitle}" subtitle="${args.subtitle}"
             ?bordered="${args.bordered}" ?compact="${args.compact}">
      <p style="margin: 0;">This is the card body content.</p>
      <div slot="footer">
        <ep-button variant="primary">Save</ep-button>
        <ep-button variant="ghost">Cancel</ep-button>
      </div>
    </ep-card>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-card')! as any;
    await host.updateComplete;
    const title = host.shadowRoot!.querySelector('.title');
    await expect(title).not.toBe(null);
    await expect(title!.textContent).toBe('Pad Settings');

    const subtitle = host.shadowRoot!.querySelector('.subtitle');
    await expect(subtitle).not.toBe(null);
    await expect(subtitle!.textContent).toContain('Configure');
  },
};

export const Bordered: Story = {
  args: { bordered: true, cardTitle: 'Import / Export' },
  render: (args) => html`
    <ep-card card-title="${args.cardTitle}" bordered>
      <p style="margin: 0;">Export your pad as HTML, plain text, or Word document.</p>
    </ep-card>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-card')!;
    await expect(host.hasAttribute('bordered')).toBe(true);
  },
};

export const Compact: Story = {
  args: { compact: true, cardTitle: 'Quick note' },
  render: (args) => html`
    <ep-card card-title="${args.cardTitle}" compact bordered>
      <p style="margin: 0;">A compact card variant.</p>
    </ep-card>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-card')!;
    await expect(host.hasAttribute('compact')).toBe(true);
  },
};

export const NoTitle: Story = {
  render: () => html`
    <ep-card>
      <p style="margin: 0;">A card without a title, just content.</p>
    </ep-card>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-card')! as any;
    await host.updateComplete;
    const header = host.shadowRoot!.querySelector('.header');
    // No title/subtitle means no header rendered
    await expect(header).toBe(null);
  },
};
