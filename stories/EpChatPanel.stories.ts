import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpChatPanel.js';
import type { EpChatEntry, EpChatPanel } from '../src/EpChatPanel.js';

type Args = { onSend: (e: Event) => void; onClose: (e: Event) => void; onSticky: (e: Event) => void; onMore: (e: Event) => void };
const meta: Meta<Args> = {
  title: 'Pad/EpChatPanel',
  component: 'ep-chat-panel',
  args: { onSend: fn(), onClose: fn(), onSticky: fn(), onMore: fn() },
};
export default meta;

const make = (n: number, from = 0): EpChatEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: String(from + i),
    author: i % 2 ? 'Ada' : 'Sam',
    authorColor: i % 2 ? '#c2255c' : '#2b8a3e',
    time: '12:0' + (i % 10),
    text: `Message ${from + i}`,
    own: i % 2 === 0,
  }));

export const Default: StoryObj<Args> = {
  render: (args) => html`
    <div style="height:360px;width:320px">
      <ep-chat-panel floating show-close show-sticky has-more heading="Chat"
        .messages=${make(30, 100)}
        @ep-chat-send=${args.onSend} @ep-chat-close=${args.onClose}
        @ep-chat-sticky=${args.onSticky} @ep-chat-load-more=${args.onMore}></ep-chat-panel>
    </div>`,
  play: async ({ canvasElement, args }) => {
    const chat = canvasElement.querySelector('ep-chat-panel') as EpChatPanel;
    await chat.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    const root = chat.shadowRoot!;
    const log = root.querySelector('.log') as HTMLElement;
    // Starts at the newest message.
    await expect(log.scrollHeight - log.scrollTop - log.clientHeight).toBeLessThan(2);

    const input = root.querySelector('textarea')!;
    await userEvent.type(input, 'Hallo{Enter}');
    await expect(((args.onSend as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent).detail).toEqual({ text: 'Hallo' });
    await expect(input.value).toBe('');
    // Shift+Enter is a line break, blank messages are not sent.
    // (dispatched directly: user-event restores its own copy of the value)
    const key = (init: KeyboardEventInit) =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init }));
    input.value = 'line';
    await expect(key({ shiftKey: true })).toBe(true); // not prevented → newline
    input.value = '   ';
    key({});
    await expect(args.onSend).toHaveBeenCalledTimes(1);

    // New message while at the bottom → stays at the bottom.
    chat.messages = [...chat.messages, ...make(1, 500)];
    await chat.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    await expect(log.scrollHeight - log.scrollTop - log.clientHeight).toBeLessThan(2);

    // Scrolled up → new messages do not pull the view down.
    log.scrollTop = 200;
    log.dispatchEvent(new Event('scroll'));
    chat.messages = [...chat.messages, ...make(1, 501)];
    await chat.updateComplete;
    await expect(log.scrollTop).toBe(200);

    // Top reached → load more once; prepending keeps the view in place.
    log.scrollTop = 0;
    log.dispatchEvent(new Event('scroll'));
    log.dispatchEvent(new Event('scroll'));
    await expect(args.onMore).toHaveBeenCalledTimes(1);
    const first = root.querySelector('ep-chat-message') as HTMLElement;
    const before = first.getBoundingClientRect().top;
    chat.loading = true;
    await chat.updateComplete;
    chat.messages = [...make(10, 0), ...chat.messages];
    chat.loading = false;
    await chat.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    await expect(Math.abs(first.getBoundingClientRect().top - before)).toBeLessThan(30);

    const sticky = root.querySelector('[part="sticky-button"]') as HTMLButtonElement;
    await userEvent.click(sticky);
    await expect(sticky.getAttribute('aria-pressed')).toBe('true');
    await expect(((args.onSticky as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent).detail).toEqual({ sticky: true });
    await userEvent.click(root.querySelector('[part="close-button"]')!);
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};

export const SlottedAndReadonly: StoryObj<Args> = {
  render: () => html`
    <div style="height:240px;width:320px">
      <ep-chat-panel readonly empty-label="No messages yet">
        <ep-chat-message slot="messages" author="Sam" time="09:00">Slotted message</ep-chat-message>
      </ep-chat-panel>
    </div>`,
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector('ep-chat-panel') as EpChatPanel;
    await chat.updateComplete;
    await expect(chat.shadowRoot!.querySelector('textarea')).toBeNull();
    await expect(chat.shadowRoot!.querySelector('.empty')).toBeNull();
  },
};

export const Empty: StoryObj<Args> = {
  render: () => html`<div style="height:200px;width:320px"><ep-chat-panel empty-label="No messages yet"></ep-chat-panel></div>`,
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector('ep-chat-panel') as EpChatPanel;
    await chat.updateComplete;
    await expect(chat.shadowRoot!.querySelector('.empty')!.textContent).toBe('No messages yet');
  },
};

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export const KeepsPositionWhenHistoryArrives: StoryObj<Args> = {
  render: (args) => html`
    <div style="height:300px;width:320px">
      <ep-chat-panel has-more .messages=${make(30, 100)} @ep-chat-load-more=${args.onMore}></ep-chat-panel>
    </div>`,
  play: async ({ canvasElement, args }) => {
    const chat = canvasElement.querySelector('ep-chat-panel') as EpChatPanel;
    await chat.updateComplete;
    await frame();
    const log = chat.shadowRoot!.querySelector('.log') as HTMLElement;
    const msgAt = (id: number) =>
      Array.from(chat.shadowRoot!.querySelectorAll('ep-chat-message')).find((m) => m.textContent === `Message ${id}`)!;

    log.scrollTop = 0;
    log.dispatchEvent(new Event('scroll'));
    await expect(args.onMore).toHaveBeenCalledTimes(1);
    const before = msgAt(100).getBoundingClientRect().top;

    // The app rebuilds all entries (new objects, same ids) and does not use `loading`.
    chat.messages = [...make(10, 0), ...make(30, 100)];
    await chat.updateComplete;
    await frame();
    await expect(Math.abs(msgAt(100).getBoundingClientRect().top - before)).toBeLessThan(2);

    // Loading more works again after the batch arrived.
    log.scrollTop = 0;
    log.dispatchEvent(new Event('scroll'));
    await expect(args.onMore).toHaveBeenCalledTimes(2);

    // A loading row that appears and disappears does not move the messages.
    const anchor = msgAt(0).getBoundingClientRect().top;
    chat.loading = true;
    await chat.updateComplete;
    await frame();
    chat.loading = false;
    await chat.updateComplete;
    await frame();
    await expect(Math.abs(msgAt(0).getBoundingClientRect().top - anchor)).toBeLessThan(2);
  },
};

export const SlottedHistoryAndEmptyLabel: StoryObj<Args> = {
  render: () => html`
    <div style="height:240px;width:320px">
      <ep-chat-panel empty-label="No messages yet"></ep-chat-panel>
    </div>`,
  play: async ({ canvasElement }) => {
    const chat = canvasElement.querySelector('ep-chat-panel') as EpChatPanel;
    await chat.updateComplete;
    const empty = () => chat.shadowRoot!.querySelector('.empty');
    await expect(empty()).not.toBeNull();

    const add = (id: number, before?: Element) => {
      const m = document.createElement('ep-chat-message');
      m.slot = 'messages';
      m.setAttribute('author', 'Sam');
      m.textContent = `Slotted ${id}`;
      chat.insertBefore(m, before ?? null);
      return m;
    };
    let first = add(100);
    for (let i = 101; i < 130; i++) add(i);
    await chat.updateComplete;
    await frame();
    await expect(empty()).toBeNull();

    const log = chat.shadowRoot!.querySelector('.log') as HTMLElement;
    log.scrollTop = 150;
    log.dispatchEvent(new Event('scroll'));
    const watched = chat.querySelectorAll('ep-chat-message')[8];
    const before = watched.getBoundingClientRect().top;
    for (let i = 99; i >= 90; i--) first = add(i, first);
    await frame();
    await expect(Math.abs(watched.getBoundingClientRect().top - before)).toBeLessThan(2);

    for (const m of Array.from(chat.querySelectorAll('ep-chat-message'))) m.remove();
    await frame();
    await chat.updateComplete;
    await expect(empty()).not.toBeNull();
  },
};
