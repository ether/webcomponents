import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, waitFor } from 'storybook/test';
import { EpNotification } from '../src/EpNotification.js';

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
  render: () => html`
    <button id="show-success">Show Success</button>
  `,
  play: async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('#show-success')! as HTMLElement;
    btn.addEventListener('click', () => EpNotification.success('Saved!'));
    await userEvent.click(btn);

    await waitFor(() => {
      const notification = document.querySelector('ep-notification');
      expect(notification).toBeInTheDocument();
    });

    const notification = document.querySelector('ep-notification')! as EpNotification;
    await expect(notification.type).toBe('success');
  },
};

export const Error: Story = {
  render: () => html`
    <button id="show-error">Show Error</button>
  `,
  play: async ({ canvasElement }) => {
    const btn = canvasElement.querySelector('#show-error')! as HTMLElement;
    btn.addEventListener('click', () => EpNotification.error('Something went wrong.'));
    await userEvent.click(btn);

    await waitFor(() => {
      const notification = document.querySelector('ep-notification');
      expect(notification).toBeInTheDocument();
    });

    const notification = document.querySelector('ep-notification')! as EpNotification;
    await expect(notification.type).toBe('error');
  },
};

export const Dismiss: Story = {
  render: () => html`
    <button id="show-dismiss">Show & Dismiss</button>
  `,
  play: async ({ canvasElement }) => {
    const notification = EpNotification.show({ text: 'Dismiss test', duration: 0 });

    await waitFor(() => {
      expect(document.querySelector('ep-notification')).toBeInTheDocument();
    });

    await notification.updateComplete;
    const closeBtn = notification.shadowRoot!.querySelector('.close')! as HTMLElement;
    await userEvent.click(closeBtn);

    // After dismiss + transition
    await waitFor(() => {
      expect(document.querySelector('ep-notification')).not.toBeInTheDocument();
    }, { timeout: 1000 });
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
