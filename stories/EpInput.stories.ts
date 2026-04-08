import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, within, fn, waitFor } from 'storybook/test';
import '../src/EpInput.js';

const meta: Meta = {
  title: 'Components/EpInput',
  component: 'ep-input',
  argTypes: {
    type: { control: 'select', options: ['text', 'password', 'email', 'number', 'textarea'] },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
  },
  args: {
    label: 'Name',
    placeholder: 'Enter your name...',
    type: 'text',
    disabled: false,
    error: false,
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <ep-input
      label="${args.label}"
      placeholder="${args.placeholder}"
      type="${args.type}"
      ?disabled="${args.disabled}"
      ?error="${args.error}"
    ></ep-input>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-input')! as any;
    await host.updateComplete;
    const input = host.shadowRoot!.querySelector('input')!;

    await expect(input).not.toBe(null);
    await expect(input.placeholder).toBe('Enter your name...');
  },
};

export const Typing: Story = {
  render: () => html`
    <ep-input label="Name" placeholder="Type here..."></ep-input>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-input')! as any;
    await host.updateComplete;
    const input = host.shadowRoot!.querySelector('input')!;
    const handler = fn();
    host.addEventListener('ep-input', handler);

    await userEvent.type(input, 'Hello World');

    await expect(input).toHaveValue('Hello World');
    await expect(handler).toHaveBeenCalled();
  },
};

export const WithHint: Story = {
  render: () => html`
    <ep-input label="Pad name" placeholder="my-document" hint="Only letters, numbers and dashes."></ep-input>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-input')! as any;
    await host.updateComplete;
    const hint = host.shadowRoot!.querySelector('.hint');
    await expect(hint).not.toBe(null);
    await expect(hint!.textContent).toContain('Only letters');
  },
};

export const WithError: Story = {
  render: () => html`
    <ep-input label="Email" type="email" placeholder="you@example.com"
              error error-text="Please enter a valid email."></ep-input>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-input')! as any;
    await host.updateComplete;
    const errorEl = host.shadowRoot!.querySelector('.error-text');
    await expect(errorEl).not.toBe(null);
    await expect(errorEl!.textContent).toContain('valid email');
  },
};

export const Textarea: Story = {
  render: () => html`
    <ep-input label="Description" type="textarea" placeholder="Write something..."></ep-input>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-input')! as any;
    await host.updateComplete;
    const textarea = host.shadowRoot!.querySelector('textarea');
    await expect(textarea).not.toBe(null);
  },
};

export const Disabled: Story = {
  render: () => html`
    <ep-input label="Read-only" value="Cannot edit" disabled></ep-input>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-input')! as any;
    await host.updateComplete;
    const input = host.shadowRoot!.querySelector('input')!;
    await expect(input).toBeDisabled();
  },
};
