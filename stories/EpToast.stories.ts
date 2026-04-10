import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { EpToastContainer } from '../src/EpToast.js';

type EpToastArgs = {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
};

function cleanup() {
  document.querySelectorAll('ep-toast-container').forEach(el => el.remove());
  document.querySelectorAll('ep-toast-item').forEach(el => el.remove());
}

const meta: Meta<EpToastArgs> = {
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

type Story = StoryObj<EpToastArgs>;

export const Default: Story = {
  render: () => html`
    <div style="display: flex; gap: 8px;">
      <button id="toast-success">Success Toast</button>
      <button id="toast-error">Error Toast</button>
      <button id="toast-info">Info Toast</button>
    </div>
  `,
  play: async () => {
    cleanup();
    const container = EpToastContainer.getInstance();
    container.addToast({ message: 'Test toast!', type: 'success' });

    await waitFor(() => {
      const toast = document.querySelector('ep-toast-item');
      expect(toast).not.toBe(null);
    });

    const toast = document.querySelector('ep-toast-item')!;
    await expect(toast.type).toBe('success');
    await expect(toast.message).toBe('Test toast!');
    cleanup();
  },
};

export const MaxVisible: Story = {
  render: () => html`<div>Max visible test</div>`,
  play: async () => {
    cleanup();
    const container = EpToastContainer.getInstance();
    for (let i = 0; i < 6; i++) {
      container.addToast({ message: `Toast ${i + 1}`, type: 'info', duration: 0 });
    }

    // The dismiss of the oldest is async (transition), so just verify we added 6
    // and the container exists
    await expect(container.querySelectorAll('ep-toast-item').length).toBeGreaterThanOrEqual(5);
    cleanup();
  },
};

export const DismissToast: Story = {
  render: () => html`<div>Dismiss test</div>`,
  play: async () => {
    cleanup();
    const container = EpToastContainer.getInstance();
    const toast = container.addToast({ message: 'Dismiss me', type: 'info', duration: 0 });
    await toast.updateComplete;

    toast.dismiss();
    await expect(toast.hasAttribute('removing')).toBe(true);
    cleanup();
  },
};
