import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpUserList.js';
import type { EpUser, EpUserList } from '../src/EpUserList.js';

type Args = { onRename: (e: Event) => void; onColor: (e: Event) => void; onSelect: (e: Event) => void };
const meta: Meta<Args> = {
  title: 'Pad/EpUserList',
  component: 'ep-user-list',
  args: { onRename: fn(), onColor: fn(), onSelect: fn() },
};
export default meta;

const users: EpUser[] = [
  { id: 'b', name: 'Zoe', color: '#ffa8a8', status: 'online' },
  { id: 'c', name: '', color: '#a5d8ff' },
  { id: 'a', name: 'Sam', color: '#b2f2bb', self: true },
  { id: 'd', name: 'Ada', color: '#ffec99', status: 'idle' },
];

export const Default: StoryObj<Args> = {
  render: (args) => html`
    <div style="width:280px">
      <ep-user-list heading="Users" selectable .users=${users}
        @ep-user-rename=${args.onRename} @ep-user-color-request=${args.onColor}
        @ep-user-select=${args.onSelect}></ep-user-list>
    </div>`,
  play: async ({ canvasElement, args }) => {
    const list = canvasElement.querySelector('ep-user-list') as EpUserList;
    await list.updateComplete;
    const root = list.shadowRoot!;
    const rows = Array.from(root.querySelectorAll('li'));
    // Own entry first, others sorted by name, unnamed last.
    await expect(rows[0].classList.contains('self')).toBe(true);
    await expect(rows.slice(1).map((r) => r.querySelector('.name')!.textContent)).toEqual(['Ada', 'Zoe', 'Unnamed']);
    await expect(root.querySelector('.heading')!.textContent).toContain('4');

    const input = root.querySelector('input')!;
    input.value = '';
    await userEvent.type(input, 'Samuel{Enter}');
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    await expect(((args.onRename as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent).detail).toEqual({ name: 'Samuel' });
    // Blurring without change does not fire again.
    input.blur();
    await expect(args.onRename).toHaveBeenCalledTimes(1);

    await userEvent.click(root.querySelector('.color-btn')!);
    await expect(args.onColor).toHaveBeenCalledTimes(1);

    await userEvent.click(rows[1]);
    await expect(((args.onSelect as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent).detail.user.name).toBe('Ada');
  },
};

export const ReadOnly: StoryObj<Args> = {
  render: () => html`<div style="width:280px"><ep-user-list readonly .users=${users}></ep-user-list></div>`,
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector('ep-user-list') as EpUserList;
    await list.updateComplete;
    await expect(list.shadowRoot!.querySelector('input')!.disabled).toBe(true);
    await expect(list.shadowRoot!.querySelector<HTMLButtonElement>('.color-btn')!.disabled).toBe(true);
  },
};

export const RenameIsSentOnce: StoryObj<Args> = {
  render: (args) => html`<div style="width:280px"><ep-user-list .users=${users} @ep-user-rename=${args.onRename}></ep-user-list></div>`,
  play: async ({ canvasElement, args }) => {
    const list = canvasElement.querySelector('ep-user-list') as EpUserList;
    await list.updateComplete;
    const input = list.shadowRoot!.querySelector('input')!;
    input.value = 'New name';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    // Unrelated update before the app applied the rename (own name still old).
    list.users = users.map((u) => (u.id === 'b' ? { ...u, name: 'Zoey' } : u));
    await list.updateComplete;
    input.dispatchEvent(new FocusEvent('blur'));
    await expect(args.onRename).toHaveBeenCalledTimes(1);
    // The app confirms the new name: no event either.
    list.users = users.map((u) => (u.self ? { ...u, name: 'New name' } : u));
    await list.updateComplete;
    input.dispatchEvent(new FocusEvent('blur'));
    await expect(args.onRename).toHaveBeenCalledTimes(1);
  },
};
