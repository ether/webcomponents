import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpTabs.js';
import type { EpTabs } from '../src/EpTabs.js';

type EpTabsArgs = {
  value: string;
  variant: 'underline' | 'pills';
  onChange: (e: Event) => void;
};

const meta: Meta<EpTabsArgs> = {
  title: 'Components/EpTabs',
  component: 'ep-tabs',
  argTypes: {
    value: { control: 'select', options: ['general', 'users', 'plugins'] },
    variant: { control: 'select', options: ['underline', 'pills'] },
  },
  args: { value: 'general', variant: 'underline', onChange: fn() },
};

export default meta;
type Story = StoryObj<EpTabsArgs>;

const tabs = (args: EpTabsArgs) => html`
  <ep-tabs value="${args.value}" variant="${args.variant}" @ep-tab-change=${args.onChange}>
    <ep-tab value="general" label="General"><p>General settings</p></ep-tab>
    <ep-tab value="users" label="Users"><p>User list</p></ep-tab>
    <ep-tab value="locked" label="Locked" disabled><p>Locked</p></ep-tab>
    <ep-tab value="plugins" label="Plugins"><p>Plugins</p></ep-tab>
  </ep-tabs>
`;

async function ready(canvasElement: HTMLElement) {
  const host = canvasElement.querySelector('ep-tabs') as EpTabs;
  await host.updateComplete;
  await new Promise((r) => requestAnimationFrame(r));
  await host.updateComplete;
  return host;
}

const buttons = (host: EpTabs) =>
  Array.from(host.shadowRoot!.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
const visible = (host: EpTabs) =>
  Array.from(host.querySelectorAll('ep-tab')).filter((t) => !t.hidden).map((t) => t.getAttribute('value'));

export const Underline: Story = {
  render: tabs,
  play: async ({ canvasElement, args }) => {
    const host = await ready(canvasElement);
    await expect(buttons(host).map((b) => b.textContent)).toEqual(['General', 'Users', 'Locked', 'Plugins']);
    await expect(visible(host)).toEqual(['general']);

    await userEvent.click(buttons(host)[1]);
    await host.updateComplete;
    await expect(host.value).toBe('users');
    await expect(visible(host)).toEqual(['users']);
    await expect(args.onChange).toHaveBeenCalledTimes(1);
    await expect(buttons(host)[1].getAttribute('aria-selected')).toBe('true');

    // Arrow keys skip the disabled tab and wrap around.
    buttons(host)[1].focus();
    await userEvent.keyboard('{ArrowRight}');
    await host.updateComplete;
    await expect(host.value).toBe('plugins');
    await userEvent.keyboard('{ArrowRight}');
    await host.updateComplete;
    await expect(host.value).toBe('general');
    await userEvent.keyboard('{End}');
    await host.updateComplete;
    await expect(host.value).toBe('plugins');
    await expect(host.shadowRoot!.activeElement?.textContent).toBe('Plugins');
  },
};

export const Pills: Story = {
  args: { variant: 'pills', value: 'users' },
  render: tabs,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    await expect(visible(host)).toEqual(['users']);
  },
};

export const UnknownValueFallsBackToFirst: Story = {
  args: { value: 'does-not-exist' },
  render: tabs,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    await expect(host.selected).toBe('general');
    await expect(visible(host)).toEqual(['general']);
  },
};

export const DuplicateValues: Story = {
  render: () => html`
    <ep-tabs>
      <ep-tab value="a" label="A1"><p>first</p></ep-tab>
      <ep-tab value="a" label="A2"><p>second</p></ep-tab>
      <ep-tab value="0" label="Zero"><p>zero</p></ep-tab>
      <ep-tab label="Positional"><p>positional</p></ep-tab>
    </ep-tabs>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const panels = Array.from(host.querySelectorAll('ep-tab'));
    const shown = () => panels.filter((t) => !t.hidden).map((t) => t.textContent!.trim());
    await expect(shown()).toEqual(['first']);
    // Every tab can still be selected on its own.
    for (const [i, text] of ['first', 'second', 'zero', 'positional'].entries()) {
      await userEvent.click(buttons(host)[i]);
      await host.updateComplete;
      await expect(shown()).toEqual([text]);
    }
  },
};

export const ArrowKeysStartAtFocusedTab: Story = {
  render: tabs,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    buttons(host)[0].focus();
    // The application changes the selection while focus stays on "General".
    host.value = 'plugins';
    await host.updateComplete;
    await userEvent.keyboard('{ArrowRight}');
    await host.updateComplete;
    await expect(host.value).toBe('users');
  },
};

export const PanelsAreLabelled: Story = {
  render: tabs,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const panel = host.querySelector('ep-tab')!;
    await expect(panel.getAttribute('role')).toBe('tabpanel');
    await expect(panel.getAttribute('aria-label')).toBe('General');
    const btn = buttons(host)[0] as HTMLButtonElement & { ariaControlsElements?: Element[] };
    if ('ariaControlsElements' in btn) {
      await expect(btn.ariaControlsElements).toEqual([panel]);
    }
  },
};
