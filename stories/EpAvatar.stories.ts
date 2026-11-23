import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect } from 'storybook/test';
import '../src/EpAvatar.js';
import type { EpAvatar } from '../src/EpAvatar.js';

const meta: Meta = { title: 'Pad/EpAvatar', component: 'ep-avatar' };
export default meta;

export const Variants: StoryObj = {
  render: () => html`
    <div style="display:flex;gap:12px;align-items:center">
      <ep-avatar id="a" name="Ada Lovelace" color="#ffd8a8" status="online"></ep-avatar>
      <ep-avatar id="b" name="sam" color="#1c3d5a" size="large" status="idle"></ep-avatar>
      <ep-avatar id="c" name="" size="small"></ep-avatar>
      <ep-avatar id="d" name="Bad" color="red;background-image:url(x)"></ep-avatar>
      <ep-avatar id="e" name="Broken picture" src="/does-not-exist.png" color="#64d29b"></ep-avatar>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const get = async (id: string) => {
      const el = canvasElement.querySelector(`#${id}`) as EpAvatar;
      await el.updateComplete;
      return el.shadowRoot!.querySelector('.circle') as HTMLElement;
    };
    const a = await get('a');
    await expect(a.textContent!.trim()).toBe('AL');
    await expect(a.getAttribute('aria-label')).toBe('Ada Lovelace');
    // Light background → dark text, dark background → white text.
    await expect(getComputedStyle(a).color).toBe('rgb(31, 35, 40)');
    await expect(getComputedStyle(await get('b')).color).toBe('rgb(255, 255, 255)');
    await expect((await get('b')).textContent!.trim()).toBe('S');
    await expect((await get('c')).textContent!.trim()).toBe('?');
    // A crafted colour cannot add other declarations.
    await expect((await get('d')).style.backgroundImage).toBe('');
    // A failing picture falls back to the initials.
    await new Promise((r) => setTimeout(r, 300));
    const e = await get('e');
    await expect(e.querySelector('img')).toBeNull();
    await expect(e.textContent!.trim()).toBe('BP');
  },
};
