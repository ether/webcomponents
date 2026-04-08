import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { EpNotification } from '../src/EpNotification.js';

// Clean up leaked notifications between tests
function cleanup() {
  document.querySelectorAll('ep-notification').forEach(el => el.remove());
  document.querySelectorAll('[id^="ep-notification-container"]').forEach(el => el.remove());
}

const meta: Meta = {
  title: 'Components/EpNotification',
  component: 'ep-notification',
  argTypes: {
    type: { control: 'select', options: ['info', 'success', 'error'] },
    position: { control: 'select', options: ['top', 'bottom'] },
    duration: { control: 'number' },
  },
};

export default meta;

type Story = StoryObj;

export const Success: Story = {
  render: () => html`<div>Success notification test</div>`,
  play: async () => {
    cleanup();
    EpNotification.success('Saved!');

    await waitFor(() => {
      const n = document.querySelector('ep-notification');
      expect(n).not.toBe(null);
    });

    const n = document.querySelector('ep-notification')! as EpNotification;
    await expect(n.type).toBe('success');
    cleanup();
  },
};

export const Error: Story = {
  render: () => html`<div>Error notification test</div>`,
  play: async () => {
    cleanup();
    EpNotification.error('Something went wrong.');

    await waitFor(() => {
      const n = document.querySelector('ep-notification');
      expect(n).not.toBe(null);
    });

    const n = document.querySelector('ep-notification')! as EpNotification;
    await expect(n.type).toBe('error');
    cleanup();
  },
};

export const Dismiss: Story = {
  render: () => html`<div>Dismiss test</div>`,
  play: async () => {
    cleanup();
    const notification = EpNotification.show({ text: 'Dismiss test', duration: 0 });
    await (notification as any).updateComplete;

    // Verify the removing attribute gets set on dismiss
    notification.dismiss();
    await expect(notification.hasAttribute('removing')).toBe(true);
    cleanup();
  },
};

export const Info: Story = {
  render: () => html`
    <button @click="${() => EpNotification.show({ text: 'New version available.', type: 'info' })}">
      Show Info
    </button>
  `,
};

export const BottomPosition: Story = {
  render: () => html`
    <button @click="${() => EpNotification.show({ text: 'Bottom notification', position: 'bottom' })}">
      Show Bottom
    </button>
  `,
};
