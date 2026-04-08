import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, waitFor } from 'storybook/test';
import { EpToastContainer } from '../src/EpToast.js';

const meta: Meta = {
  title: 'Components/EpToast',
  component: 'ep-toast-container',
  argTypes: {
    position: {
      control: 'select',
      options: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
    },
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px;">
      <button id="toast-success">Success Toast</button>
      <button id="toast-error">Error Toast</button>
      <button id="toast-info">Info Toast</button>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const container = EpToastContainer.getInstance();
    container.addToast({ message: 'Test toast!', type: 'success' });

    await waitFor(() => {
      const toast = document.querySelector('ep-toast-item');
      expect(toast).toBeInTheDocument();
    });

    const toast = document.querySelector('ep-toast-item')! as any;
    await expect(toast.type).toBe('success');
    await expect(toast.message).toBe('Test toast!');
  },
};

export const MaxVisible: Story = {
  render: () => html`<div>Max visible test</div>`,
  play: async () => {
    const container = EpToastContainer.getInstance();
    // Add 6 toasts — only 5 should remain
    for (let i = 0; i < 6; i++) {
      container.addToast({ message: `Toast ${i + 1}`, type: 'info', duration: 0 });
    }

    await waitFor(() => {
      const toasts = document.querySelectorAll('ep-toast-item');
      expect(toasts.length).toBeLessThanOrEqual(5);
    });
  },
};

export const DismissToast: Story = {
  render: () => html`<div>Dismiss test</div>`,
  play: async () => {
    const container = EpToastContainer.getInstance();
    const toast = container.addToast({ message: 'Dismiss me', type: 'info', duration: 0 });

    await waitFor(() => {
      expect(document.querySelector('ep-toast-item')).toBeInTheDocument();
    });

    await (toast as any).updateComplete;
    const closeBtn = toast.shadowRoot!.querySelector('.close')! as HTMLElement;
    await userEvent.click(closeBtn);

    await waitFor(() => {
      const remaining = container.querySelectorAll('ep-toast-item');
      // The dismissed toast should be gone or in removing state
      expect(remaining.length).toBeLessThanOrEqual(0);
    }, { timeout: 1000 });
  },
};
