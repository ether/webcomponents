import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect } from 'storybook/test';
import '../src/EpTheme.js';
import '../src/EpToolbar.js';
import '../src/EpUserList.js';
import '../src/EpChatPanel.js';
import '../src/EpPopup.js';
import '../src/EpSettings.js';
import '../src/EpCheckbox.js';
import '../src/EpSegmented.js';
import type { EpPopup } from '../src/EpPopup.js';

const i = (d: string) => html`<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d=${d}/></svg>`;
const P = {
  bold: 'M4 2h4.5a3 3 0 0 1 2.1 5.15A3.25 3.25 0 0 1 9.25 14H4V2zm2 2v3h2.5a1.5 1.5 0 0 0 0-3H6zm0 5v3h3.25a1.5 1.5 0 0 0 0-3H6z',
  italic: 'M6 2h6v2H9.9l-2 8H10v2H4v-2h2.1l2-8H6z',
  list: 'M2 3h2v2H2zm4 0h8v2H6zM2 7h2v2H2zm4 0h8v2H6zm-4 4h2v2H2zm4 0h8v2H6z',
  undo: 'M5.5 3 1.5 7l4 4V8h4a3 3 0 0 1 0 6H8v2h1.5a5 5 0 0 0 0-10h-4z',
  history: 'M8 1a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 8 3v2L4.5 2 8-1zM7 5h2v3.6l2.4 1.4-1 1.7L7 9.7z',
  gear: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm6 3-.1-1 1.5-1.2-1.5-2.6-1.8.6a5 5 0 0 0-1.7-1L10 0H7l-.4 1.8a5 5 0 0 0-1.7 1l-1.8-.6L1.6 4.8 3.1 6 3 8l.1 1-1.5 1.2 1.5 2.6 1.8-.6a5 5 0 0 0 1.7 1L7 16h3l.4-1.8a5 5 0 0 0 1.7-1l1.8.6 1.5-2.6L13.9 9z',
  users: 'M6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 8a5 5 0 0 1 10 0zm10.5-8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM12 15a6 6 0 0 0-1.6-4.2A4.5 4.5 0 0 1 16 15z',
};

type Args = { theme: string };
const meta: Meta<Args> = {
  title: 'Pad/Layout',
  argTypes: { theme: { control: 'select', options: ['colibris', 'colibris-dark', 'high-contrast', 'warm'] } },
  args: { theme: 'colibris' },
  parameters: { layout: 'fullscreen' },
};
export default meta;

export const Pad: StoryObj<Args> = {
  render: (args) => html`
    <ep-theme name=${args.theme}>
      <div style="display:flex;flex-direction:column;height:640px;background:var(--bg-soft-color);font-family:var(--main-font-family)">
        <ep-toolbar label="Pad toolbar">
          <ep-toolbar-button key="bold" label="Bold" toggle pressed>${i(P.bold)}</ep-toolbar-button>
          <ep-toolbar-button key="italic" label="Italic" toggle>${i(P.italic)}</ep-toolbar-button>
          <ep-toolbar-separator priority="low"></ep-toolbar-separator>
          <ep-toolbar-button key="list" label="List" priority="low">${i(P.list)}</ep-toolbar-button>
          <ep-toolbar-button key="undo" label="Undo" priority="low">${i(P.undo)}</ep-toolbar-button>
          <ep-toolbar-button slot="end" key="history" label="Timeslider">${i(P.history)}</ep-toolbar-button>
          <ep-toolbar-button slot="end" id="settings-btn" key="settings" label="Settings" active expanded="true"
            @click=${(e: Event) => ((e.currentTarget as HTMLElement).closest('ep-theme')!.querySelector('ep-popup') as EpPopup).toggle()}>${i(P.gear)}</ep-toolbar-button>
          <ep-toolbar-button slot="end" key="users" label="Users" badge="3">${i(P.users)}</ep-toolbar-button>
        </ep-toolbar>
        <div style="flex:1;display:flex;gap:16px;padding:16px;min-height:0">
          <div style="flex:1;background:var(--bg-color);color:var(--text-color);border-radius:var(--radius-large);box-shadow:var(--shadow);padding:24px 32px;line-height:1.6">
            <h1 style="margin-top:0">Meeting notes</h1>
            <p>Collaborative text with <b>bold</b> parts and a list:</p>
            <ul><li>Theme tokens</li><li>Pad building blocks</li></ul>
          </div>
          <div style="width:280px;display:flex;flex-direction:column;gap:16px;min-height:0">
            <div style="background:var(--bg-color);border-radius:var(--radius-large);box-shadow:var(--shadow);padding:14px">
              <ep-user-list heading="Users" .users=${[
                { id: '1', name: 'Sam', color: '#b2f2bb', self: true },
                { id: '2', name: 'Ada Lovelace', color: '#ffc9c9', status: 'online' },
                { id: '3', name: '', color: '#a5d8ff', status: 'idle' },
              ]}></ep-user-list>
            </div>
            <div style="flex:1;min-height:0">
              <ep-chat-panel floating show-close show-sticky .messages=${[
                { author: 'Ada Lovelace', authorColor: '#c2255c', time: '10:02', text: 'Morning! Agenda is in the pad.' },
                { author: 'Sam', authorColor: '#2b8a3e', time: '10:03', text: 'Thanks, adding the theme part now.', own: true },
              ]}></ep-chat-panel>
            </div>
          </div>
        </div>
        <ep-popup anchor="settings-btn" heading="Settings" open>
          <ep-settings-section heading="My view">
            <ep-settings-row label="Chat"><ep-checkbox checked></ep-checkbox></ep-settings-row>
            <ep-settings-row label="Line numbers" description="Show numbers in the margin"><ep-checkbox checked></ep-checkbox></ep-settings-row>
            <ep-settings-row label="Appearance">
              <ep-segmented value="light" .options=${[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}></ep-segmented>
            </ep-settings-row>
          </ep-settings-section>
        </ep-popup>
      </div>
    </ep-theme>
  `,
  play: async ({ canvasElement }) => {
    const popup = canvasElement.querySelector('ep-popup') as EpPopup;
    await popup.updateComplete;
    await expect(popup.open).toBe(true);
  },
};
