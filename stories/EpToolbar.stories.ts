import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpToolbar.js';
import type { EpToolbar, EpToolbarButton } from '../src/EpToolbar.js';

const icon = (d: string) => html`<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d=${d}/></svg>`;
const B = 'M4 2h4.5a3 3 0 0 1 2.1 5.15A3.25 3.25 0 0 1 9.25 14H4V2zm2 2v3h2.5a1.5 1.5 0 0 0 0-3H6zm0 5v3h3.25a1.5 1.5 0 0 0 0-3H6z';
const I = 'M6 2h6v2H9.9l-2 8H10v2H4v-2h2.1l2-8H6z';
const U = 'M4 2h2v5a2 2 0 0 0 4 0V2h2v5a4 4 0 0 1-8 0zM3 13h10v1.5H3z';
const LIST = 'M2 3h2v2H2zm4 0h8v2H6zM2 7h2v2H2zm4 0h8v2H6zm-4 4h2v2H2zm4 0h8v2H6z';
const GEAR = 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm6 3-.1-1 1.5-1.2-1.5-2.6-1.8.6a5 5 0 0 0-1.7-1L10 0H7l-.4 1.8a5 5 0 0 0-1.7 1l-1.8-.6L1.6 4.8 3.1 6 3 8l.1 1-1.5 1.2 1.5 2.6 1.8-.6a5 5 0 0 0 1.7 1L7 16h3l.4-1.8a5 5 0 0 0 1.7-1l1.8.6 1.5-2.6L13.9 9z';
const USERS = 'M6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 8a5 5 0 0 1 10 0zm10.5-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 15a6 6 0 0 0-1.6-4.2A4.5 4.5 0 0 1 16 15z';

type Args = { onAction: (e: Event) => void; breakpoint: number };

const meta: Meta<Args> = {
  title: 'Pad/EpToolbar',
  component: 'ep-toolbar',
  args: { onAction: fn(), breakpoint: 800 },
};
export default meta;
type Story = StoryObj<Args>;

const bar = (args: Args, width = '100%') => html`
  <div style="width:${width}">
    <ep-toolbar label="Formatting" breakpoint=${args.breakpoint} @ep-toolbar-action=${args.onAction}>
      <ep-toolbar-button key="bold" label="Bold" toggle>${icon(B)}</ep-toolbar-button>
      <ep-toolbar-button key="italic" label="Italic" toggle>${icon(I)}</ep-toolbar-button>
      <ep-toolbar-button key="underline" label="Underline" toggle>${icon(U)}</ep-toolbar-button>
      <ep-toolbar-separator></ep-toolbar-separator>
      <ep-toolbar-button key="list" label="Bulleted list" priority="low">${icon(LIST)}</ep-toolbar-button>
      <ep-toolbar-button key="disabled" label="Disabled" disabled priority="low">${icon(LIST)}</ep-toolbar-button>
      <ep-toolbar-button slot="end" key="settings" label="Settings" expanded="false">${icon(GEAR)}</ep-toolbar-button>
      <ep-toolbar-button slot="end" key="users" label="Users" badge="3">${icon(USERS)}</ep-toolbar-button>
    </ep-toolbar>
  </div>
`;

const ready = async (root: HTMLElement) => {
  const tb = root.querySelector('ep-toolbar') as EpToolbar;
  await tb.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await tb.updateComplete;
  return tb;
};
const inner = (b: EpToolbarButton) => b.shadowRoot!.querySelector('button')!;

export const Default: Story = {
  render: (args) => bar(args),
  play: async ({ canvasElement, args }) => {
    const tb = await ready(canvasElement);
    const [bold, italic] = tb.items;
    await expect(tb.items.length).toBe(7);
    await expect(inner(bold).getAttribute('aria-label')).toBe('Bold');
    await expect(inner(bold).getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(inner(bold));
    await expect(bold.pressed).toBe(true);
    await expect(inner(bold).getAttribute('aria-pressed')).toBe('true');
    await expect(args.onAction).toHaveBeenCalledTimes(1);
    const ev = (args.onAction as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent;
    await expect(ev.detail).toEqual({ key: 'bold', pressed: true });

    // Roving tabindex: only the focused button is tabbable; arrows move.
    await expect(inner(bold).tabIndex).toBe(0);
    await expect(inner(italic).tabIndex).toBe(-1);
    await userEvent.keyboard('{ArrowRight}');
    await expect(italic.shadowRoot!.activeElement).toBe(inner(italic));
    await expect(inner(italic).tabIndex).toBe(0);
    await userEvent.keyboard('{End}');
    await expect(tb.items[tb.items.length - 1].getAttribute('key')).toBe('users');
    await userEvent.keyboard('{ArrowRight}');
    await expect(bold.shadowRoot!.activeElement).toBe(inner(bold));

    // Disabled buttons do not fire actions.
    const disabled = tb.items.find((b) => b.key === 'disabled')!;
    await userEvent.click(inner(disabled));
    await expect(args.onAction).toHaveBeenCalledTimes(1);
  },
};

export const Compact: Story = {
  render: (args) => bar(args, '420px'),
  play: async ({ canvasElement }) => {
    const tb = await ready(canvasElement);
    await expect(tb.compact).toBe(true);
    const low = tb.querySelector('[key="list"]')!;
    await expect(low.getAttribute('slot')).toBe('overflow');
    // Hidden overflow items are not reachable by arrow keys.
    await expect(tb.items.some((b) => b.key === 'list')).toBe(false);

    const more = tb.shadowRoot!.querySelector('.more') as EpToolbarButton;
    await userEvent.click(inner(more));
    await tb.updateComplete;
    await expect(tb.expanded).toBe(true);
    await expect(inner(more).getAttribute('aria-expanded')).toBe('true');
    await expect(tb.items.some((b) => b.key === 'list')).toBe(true);

    // Back to wide: items return to their slot.
    tb.breakpoint = 0;
    await tb.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    await expect(tb.compact).toBe(false);
    await expect(low.hasAttribute('slot')).toBe(false);
  },
};
