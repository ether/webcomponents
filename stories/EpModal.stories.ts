import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, waitFor } from 'storybook/test';
import { EpModal } from '../src/EpModal.js';

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

export const Default: Story = {
  render: (args) => html`
    <ep-modal modal-title="${args.modalTitle}" ?open="${args.open}">
      <p style="margin: 0;">This is the modal body content.</p>
      <div slot="actions">
        <button data-action="close">Close</button>
      </div>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = canvasElement.querySelector('ep-modal')! as EpModal;
    await modal.updateComplete;

    // open is a reflected boolean attribute — check via hasAttribute as fallback
    await expect(modal.hasAttribute('open')).toBe(true);

    const dialog = modal.shadowRoot!.querySelector('[role="dialog"]');
    await expect(dialog).not.toBe(null);

    const title = modal.shadowRoot!.querySelector('.title');
    await expect(title!.textContent).toBe('Example Modal');
  },
};

export const OpenClose: Story = {
  render: () => html`
    <button id="open-btn">Open Modal</button>
    <ep-modal modal-title="Test Modal">
      <p style="margin: 0;">Modal content</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = canvasElement.querySelector('ep-modal')! as EpModal;

    // Initially closed
    await expect(modal.open).toBe(false);

    // Open it
    modal.open = true;
    await waitFor(() => expect(modal.open).toBe(true));

    // Close via method
    modal.close();
    await waitFor(() => expect(modal.open).toBe(false));
  },
};

export const CloseOnEscape: Story = {
  render: () => html`
    <ep-modal modal-title="Press Escape" open>
      <p style="margin: 0;">Press Escape to close.</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = canvasElement.querySelector('ep-modal')! as EpModal;
    await expect(modal.open).toBe(true);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(modal.open).toBe(false));
  },
};

export const CloseButton: Story = {
  render: () => html`
    <ep-modal modal-title="Close Button Test" open>
      <p style="margin: 0;">Click the X to close.</p>
    </ep-modal>
  `,
  play: async ({ canvasElement }) => {
    const modal = canvasElement.querySelector('ep-modal')! as EpModal;
    await expect(modal.open).toBe(true);

    await modal.updateComplete;
    const closeBtn = modal.shadowRoot!.querySelector('.close-btn')! as HTMLElement;
    await userEvent.click(closeBtn);
    await waitFor(() => expect(modal.open).toBe(false));
  },
};

export const ConfirmDialog: Story = {
  render: () => html`
    <button id="confirm-trigger">Show Confirm</button>
  `,
};

export const PromptDialog: Story = {
  render: () => html`
    <button id="prompt-trigger">Show Prompt</button>
  `,
};
