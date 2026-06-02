import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn, waitFor } from 'storybook/test';
import '../src/EpSelect.js';

type EpSelectArgs = {
  value: string;
  placeholder: string;
  disabled: boolean;
};

const OPTIONS = [
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'p', label: 'Paragraph' },
  { value: 'code', label: 'Code', disabled: true },
];

const meta: Meta<EpSelectArgs> = {
  title: 'Components/EpSelect',
  component: 'ep-select',
  args: { value: '', placeholder: 'Select…', disabled: false },
};
export default meta;
type Story = StoryObj<EpSelectArgs>;

async function getSelect(canvasElement: HTMLElement) {
  const host = canvasElement.querySelector('ep-select')! as any;
  host.options = OPTIONS;
  await host.updateComplete;
  const root = host.shadowRoot!;
  return {
    host,
    box: root.querySelector('.nice-select') as HTMLElement,
    current: root.querySelector('.current') as HTMLElement,
    list: root.querySelector('.list') as HTMLElement,
    options: () => Array.from(root.querySelectorAll('.option')) as HTMLElement[],
  };
}

export const Default: Story = {
  render: (a) => html`<ep-select placeholder="${a.placeholder}"></ep-select>`,
  play: async ({ canvasElement }) => {
    const { box, current, options } = await getSelect(canvasElement);
    await expect(box).not.toBe(null);
    // shows the placeholder when nothing is selected
    await expect(current.textContent?.trim()).toBe('Select…');
    // renders one .option per provided option
    await expect(options().length).toBe(OPTIONS.length);
  },
};

export const OpensOnClick: Story = {
  render: () => html`<ep-select placeholder="Select…"></ep-select>`,
  play: async ({ canvasElement }) => {
    const { host, box } = await getSelect(canvasElement);
    await expect(host.hasAttribute('open')).toBe(false);
    await userEvent.click(box);
    await waitFor(() => expect(host.hasAttribute('open')).toBe(true));
  },
};

export const SelectsOption: Story = {
  render: () => html`<ep-select placeholder="Select…"></ep-select>`,
  play: async ({ canvasElement }) => {
    const { host, box, current, options } = await getSelect(canvasElement);
    const handler = fn();
    host.addEventListener('ep-select:change', handler);

    await userEvent.click(box);
    await userEvent.click(options()[1]); // Heading 2

    await expect(host.value).toBe('h2');
    await expect(current.textContent?.trim()).toBe('Heading 2');
    await expect(host.hasAttribute('open')).toBe(false); // closes after select
    await expect(handler).toHaveBeenCalledTimes(1);
    await expect(handler.mock.calls[0][0].detail).toEqual({ value: 'h2', label: 'Heading 2' });
  },
};

export const PreselectedValue: Story = {
  render: () => html`<ep-select value="p"></ep-select>`,
  play: async ({ canvasElement }) => {
    const { current, options } = await getSelect(canvasElement);
    await expect(current.textContent?.trim()).toBe('Paragraph');
    const selected = options().find((o) => o.classList.contains('selected'));
    await expect(selected?.textContent?.trim()).toBe('Paragraph');
  },
};

export const DisabledDoesNotOpen: Story = {
  render: () => html`<ep-select placeholder="Select…" disabled></ep-select>`,
  play: async ({ canvasElement }) => {
    const { host, box } = await getSelect(canvasElement);
    // pointer-events:none already blocks real clicks; bypass that to confirm
    // the JS guard keeps it closed too.
    await userEvent.click(box, { pointerEventsCheck: 0 });
    await expect(host.hasAttribute('open')).toBe(false);
  },
};

export const DisabledOptionNotSelectable: Story = {
  render: () => html`<ep-select placeholder="Select…"></ep-select>`,
  play: async ({ canvasElement }) => {
    const { host, box, options } = await getSelect(canvasElement);
    await userEvent.click(box);
    const codeOption = options().find((o) => o.textContent?.trim() === 'Code')!;
    await expect(codeOption.classList.contains('disabled')).toBe(true);
    await userEvent.click(codeOption);
    await expect(host.value).toBe(''); // disabled option does not select
  },
};
