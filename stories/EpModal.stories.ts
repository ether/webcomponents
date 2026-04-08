import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { EpModal } from '../src/EpModal.js';
import '../src/EpModal.js';

const meta: Meta = {
  title: 'Components/EpModal',
  component: 'ep-modal',
  argTypes: {
    modalTitle: { control: 'text' },
    open: { control: 'boolean' },
  },
  args: {
    modalTitle: 'Example Modal',
    open: true,
  },
};

export default meta;

type Story = StoryObj;

async function getModal(canvasElement: HTMLElement): Promise<EpModal> {
  await customElements.whenDefined('ep-modal');
  const modal = canvasElement.querySelector('ep-modal')! as EpModal;
  await modal.updateComplete;
  return modal;
}

export const Default: Story = {
  render: (args) => html`
    <ep-modal modal-title="${args.modalTitle}" ?open="${args.open}">
      <p style="margin: 0;">This is the modal body content.</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = await getModal(canvasElement);
    await expect(modal.hasAttribute('open')).toBe(true);
    await expect(modal.modalTitle).toBe('Example Modal');
  },
};

export const OpenClose: Story = {
  render: () => html`
    <ep-modal modal-title="Test Modal">
      <p style="margin: 0;">Modal content</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = await getModal(canvasElement);

    // Initially closed
    await expect(modal.hasAttribute('open')).toBe(false);

    // Open
    modal.open = true;
    await modal.updateComplete;
    await expect(modal.hasAttribute('open')).toBe(true);

    // Close
    modal.open = false;
    await modal.updateComplete;
    await expect(modal.hasAttribute('open')).toBe(false);
  },
};

export const CloseOnEscape: Story = {
  render: () => html`
    <ep-modal modal-title="Press Escape" open>
      <p style="margin: 0;">Press Escape to close.</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = await getModal(canvasElement);
    await expect(modal.hasAttribute('open')).toBe(true);

    // Focus the dialog so keyboard events reach it
    const dialog = modal.renderRoot?.querySelector<HTMLElement>('.dialog');
    dialog?.focus();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(modal.hasAttribute('open')).toBe(false));
  },
};

export const CloseButton: Story = {
  render: () => html`
    <ep-modal modal-title="Close Button Test" open>
      <p style="margin: 0;">Click the X to close.</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = await getModal(canvasElement);
    await expect(modal.hasAttribute('open')).toBe(true);

    const closeBtn = modal.renderRoot?.querySelector('.close-btn') as HTMLElement;
    await expect(closeBtn).not.toBe(null);
    await userEvent.click(closeBtn);
    await waitFor(() => expect(modal.hasAttribute('open')).toBe(false));
  },
};

export const ConfirmDialog: Story = {
  render: () => html`<button id="confirm-trigger">Show Confirm</button>`,
};

export const PromptDialog: Story = {
  render: () => html`<button id="prompt-trigger">Show Prompt</button>`,
};
