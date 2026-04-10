import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect } from 'storybook/test';
import '../src/EpUserBadge.js';

type EpUserBadgeArgs = {
  name: string;
  color: string;
  size: 'small' | 'medium' | 'large';
  online: boolean;
};

const meta: Meta<EpUserBadgeArgs> = {
  title: 'Components/EpUserBadge',
  component: 'ep-user-badge',
  argTypes: {
    name: { control: 'text' },
    color: { control: 'color' },
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    online: { control: 'boolean' },
  },
  args: {
    name: 'John Doe',
    color: '#485365',
    size: 'medium',
    online: false,
  },
};

export default meta;

type Story = StoryObj<EpUserBadgeArgs>;

export const Default: Story = {
  render: (args: EpUserBadgeArgs) => html`
    <ep-user-badge
      name="${args.name}"
      color="${args.color}"
      size="${args.size}"
      ?online="${args.online}"
    ></ep-user-badge>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-user-badge')!;
    await host.updateComplete;
    const avatar = host.shadowRoot!.querySelector('.avatar');
    const nameEl = host.shadowRoot!.querySelector('.name');

    await expect(avatar).not.toBe(null);
    await expect(avatar!.textContent!.trim()).toBe('J');
    await expect(nameEl!.textContent).toBe('John Doe');
  },
};

export const Online: Story = {
  args: { name: 'Alice', color: '#e57373', online: true },
  render: (args: EpUserBadgeArgs) => html`
    <ep-user-badge name="${args.name}" color="${args.color}" online></ep-user-badge>
  `,
  play: async ({ canvasElement }) => {
    const host = canvasElement.querySelector('ep-user-badge')!;
    await expect(host.hasAttribute('online')).toBe(true);
  },
};

export const UserList: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <ep-user-badge name="Alice" color="#e57373" online></ep-user-badge>
      <ep-user-badge name="Bob" color="#64b5f6" online></ep-user-badge>
      <ep-user-badge name="Charlie" color="#81c784"></ep-user-badge>
      <ep-user-badge name="Diana" color="#ffb74d" online></ep-user-badge>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('ep-user-badge');
    await expect(badges.length).toBe(4);

    // Check initials
    await Promise.all(Array.from(badges).map(b => b.updateComplete));
    const initials = Array.from(badges).map(
      b => b.shadowRoot!.querySelector('.avatar')!.textContent!.trim()
    );
    await expect(initials).toEqual(['A', 'B', 'C', 'D']);
  },
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; gap: 16px; align-items: center;">
      <ep-user-badge name="Small" color="#64b5f6" size="small"></ep-user-badge>
      <ep-user-badge name="Medium" color="#e57373" size="medium"></ep-user-badge>
      <ep-user-badge name="Large" color="#81c784" size="large"></ep-user-badge>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const badges = canvasElement.querySelectorAll('ep-user-badge');
    await expect(badges[0].getAttribute('size')).toBe('small');
    await expect(badges[1].getAttribute('size')).toBe('medium');
    await expect(badges[2].getAttribute('size')).toBe('large');
  },
};
