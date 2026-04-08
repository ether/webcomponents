import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect } from 'storybook/test';
import '../src/EpChatMessage.js';

const meta: Meta = {
  title: 'Components/EpChatMessage',
  component: 'ep-chat-message',
  argTypes: {
    author: { control: 'text' },
    authorColor: { control: 'color' },
    time: { control: 'text' },
    own: { control: 'boolean' },
  },
  args: {
    author: 'Alice',
    authorColor: '#e57373',
    time: '14:32',
    own: false,
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <ep-chat-message
      author="${args.author}"
      author-color="${args.authorColor}"
      time="${args.time}"
      ?own="${args.own}">
      Hey, did you see the latest changes?
    </ep-chat-message>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-chat-message')! as any;
    await host.updateComplete;
    const author = host.shadowRoot!.querySelector('.author');
    const time = host.shadowRoot!.querySelector('.time');

    await expect(author!.textContent).toBe('Alice');
    await expect(time!.textContent).toBe('14:32');
  },
};

export const OwnMessage: Story = {
  args: { author: 'You', authorColor: '#64b5f6', own: true },
  render: (args) => html`
    <ep-chat-message author="${args.author}" author-color="${args.authorColor}" time="14:33" own>
      Yes, looks good to me!
    </ep-chat-message>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-chat-message')!;
    await expect(host.hasAttribute('own')).toBe(true);
  },
};

export const Conversation: Story = {
  render: () => html`
    <div style="max-width: 400px; background: var(--bg-soft-color, #f2f3f4); border-radius: 5px; overflow: hidden;">
      <ep-chat-message author="Alice" author-color="#e57373" time="14:30">
        Has anyone reviewed the intro section?
      </ep-chat-message>
      <ep-chat-message author="Bob" author-color="#64b5f6" time="14:31">
        I'll take a look now.
      </ep-chat-message>
      <ep-chat-message author="You" author-color="#81c784" time="14:32" own>
        I already made some edits there. Check the second paragraph.
      </ep-chat-message>
      <ep-chat-message author="Alice" author-color="#e57373" time="14:33">
        Great, thanks! Looks much better.
      </ep-chat-message>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const messages = canvasElement.querySelectorAll('ep-chat-message');
    await expect(messages.length).toBe(4);

    // Check the own message
    const ownMsg = canvasElement.querySelector('ep-chat-message[own]')!;
    await expect(ownMsg).toBeInTheDocument();
    await expect(ownMsg.getAttribute('author')).toBe('You');
  },
};
