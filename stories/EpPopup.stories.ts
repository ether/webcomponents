import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpPopup.js';
import '../src/EpSettings.js';
import '../src/EpSegmented.js';
import '../src/EpCheckbox.js';
import '../src/EpButton.js';
import type { EpPopup } from '../src/EpPopup.js';
import type { EpSegmented } from '../src/EpSegmented.js';
import type { EpCheckbox } from '../src/EpCheckbox.js';

type Args = { onClose: (e: Event) => void; onChange: (e: Event) => void };
const meta: Meta<Args> = {
  title: 'Pad/EpPopup',
  component: 'ep-popup',
  args: { onClose: fn(), onChange: fn() },
};
export default meta;

const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15A9 9 0 1 1 9 3a7 7 0 0 0 12 12z"/></svg>';

export const Settings: StoryObj<Args> = {
  render: (args) => html`
    <div style="display:flex;justify-content:flex-end;padding:8px 40px;min-height:480px">
      <button id="anchor" @click=${() => (document.querySelector('ep-popup') as EpPopup).toggle()}>Settings</button>
    </div>
    <ep-popup anchor="anchor" heading="Settings" @ep-popup-close=${args.onClose}>
      <ep-settings-section heading="My view">
        <ep-settings-row label="Chat" description="Show the chat box">
          <ep-checkbox id="chat" checked></ep-checkbox>
        </ep-settings-row>
        <ep-settings-row label="Line numbers"><ep-checkbox id="lines"></ep-checkbox></ep-settings-row>
        <ep-settings-row label="Appearance">
          <ep-segmented id="theme" value="light" @ep-change=${args.onChange}
            .options=${[
              { value: 'light', label: 'Light', icon: SUN },
              { value: 'dark', label: 'Dark', icon: MOON },
              { value: 'system', label: 'System', disabled: true },
            ]}></ep-segmented>
        </ep-settings-row>
      </ep-settings-section>
      <ep-settings-section heading="Pad settings" description="Apply to everyone">
        <ep-settings-row label="Language" stacked divided><select><option>Deutsch</option></select></ep-settings-row>
      </ep-settings-section>
      <ep-button slot="footer" variant="primary">Done</ep-button>
    </ep-popup>
  `,
  play: async ({ canvasElement, args }) => {
    const popup = canvasElement.querySelector('ep-popup') as EpPopup;
    const anchor = canvasElement.querySelector('#anchor') as HTMLButtonElement;
    await expect(popup.open).toBe(false);

    await userEvent.click(anchor);
    await popup.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    await expect(popup.open).toBe(true);
    const box = popup.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    await expect(Math.round(box.top)).toBe(Math.round(a.bottom + 6));
    await expect(Math.abs(box.right - a.right)).toBeLessThan(2);
    // Focus moved into the popup.
    await expect(popup.contains(document.activeElement)).toBe(true);

    // Clicking a row label toggles its checkbox; the row names the control.
    const lines = canvasElement.querySelector('#lines') as EpCheckbox;
    await expect(lines.shadowRoot!.querySelector('input')!.getAttribute('aria-label')).toBe('Line numbers');
    const row = lines.closest('ep-settings-row')!;
    await userEvent.click(row.shadowRoot!.querySelector('.label')!);
    await expect(lines.checked).toBe(true);
    await expect(canvasElement.querySelector('select')!.getAttribute('aria-label')).toBe('Language');

    // Segmented control: click and arrows, disabled option skipped.
    const seg = canvasElement.querySelector('#theme') as EpSegmented;
    const radios = Array.from(seg.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    await userEvent.click(radios[1]);
    await expect(seg.value).toBe('dark');
    await userEvent.keyboard('{ArrowRight}');
    await expect(seg.value).toBe('light');
    await expect(args.onChange).toHaveBeenCalledTimes(2);

    // Escape closes and returns focus to the anchor.
    await userEvent.keyboard('{Escape}');
    await expect(popup.open).toBe(false);
    await expect(document.activeElement).toBe(anchor);
    await expect(((args.onClose as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent).detail).toEqual({ reason: 'escape' });

    // Outside click closes; clicking the anchor toggles instead of double-handling.
    await userEvent.click(anchor);
    await popup.updateComplete;
    await expect(popup.open).toBe(true);
    await userEvent.click(canvasElement.querySelector('div')!, { pointerEventsCheck: 0 });
    await expect(popup.open).toBe(false);
    await expect(((args.onClose as ReturnType<typeof fn>).mock.calls[1][0] as CustomEvent).detail).toEqual({ reason: 'outside' });
    await userEvent.click(anchor);
    await popup.updateComplete;
    await userEvent.click(anchor);
    await popup.updateComplete;
    await expect(popup.open).toBe(false);
  },
};

export const Persistent: StoryObj<Args> = {
  render: () => html`<ep-popup open persistent heading="Persistent"><p>Stays open.</p></ep-popup>`,
  play: async ({ canvasElement }) => {
    const popup = canvasElement.querySelector('ep-popup') as EpPopup;
    await popup.updateComplete;
    await userEvent.keyboard('{Escape}');
    await userEvent.click(document.body, { pointerEventsCheck: 0 });
    await expect(popup.open).toBe(true);
    await userEvent.click(popup.shadowRoot!.querySelector('.close')!);
    await expect(popup.open).toBe(false);
  },
};

export const StaysInsideViewport: StoryObj<Args> = {
  render: () => html`
    <div style="display:flex;justify-content:flex-end;padding:8px 20px">
      <button id="edge">Edge</button>
    </div>
    <ep-popup anchor="edge" align="start" heading="Start aligned"><p>Content</p></ep-popup>`,
  play: async ({ canvasElement }) => {
    const popup = canvasElement.querySelector('ep-popup') as EpPopup;
    popup.show();
    await popup.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    const box = popup.getBoundingClientRect();
    await expect(box.right).toBeLessThanOrEqual(document.documentElement.clientWidth - 11);
    await expect(box.left).toBeGreaterThanOrEqual(11);
  },
};

export const ClosedByTheApp: StoryObj<Args> = {
  render: (args) => html`
    <button id="opener">Open</button>
    <ep-popup anchor="opener" heading="Controlled" @ep-popup-close=${args.onClose}><button id="inside">Inside</button></ep-popup>`,
  play: async ({ canvasElement, args }) => {
    const popup = canvasElement.querySelector('ep-popup') as EpPopup;
    const opener = canvasElement.querySelector('#opener') as HTMLButtonElement;
    opener.focus();
    popup.open = true;
    await popup.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    await expect(document.activeElement).toBe(canvasElement.querySelector('#inside'));
    // The app sets the property directly.
    popup.open = false;
    await popup.updateComplete;
    await expect(args.onClose).toHaveBeenCalledTimes(1);
    await expect(((args.onClose as ReturnType<typeof fn>).mock.calls[0][0] as CustomEvent).detail).toEqual({ reason: 'api' });
    await expect(document.activeElement).toBe(opener);
  },
};

export const RowSyncsControl: StoryObj<Args> = {
  render: () => html`
    <ep-settings-row id="r1" label="Chat" disabled><ep-checkbox id="c1"></ep-checkbox></ep-settings-row>
    <ep-settings-row id="r2" label="Font"><select id="s1"><option>A</option></select></ep-settings-row>
    <ep-settings-row id="r3" label="Theme"><ep-segmented id="g1" .options=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}></ep-segmented></ep-settings-row>
    <ep-settings-row id="r4" label="Own"><select id="s2" aria-label="Page label"><option>A</option></select></ep-settings-row>
    <ep-settings-row id="r5" label="Locked" disabled><select id="s3" disabled><option>A</option></select></ep-settings-row>`,
  play: async ({ canvasElement }) => {
    const $ = <T extends Element>(id: string) => canvasElement.querySelector(`#${id}`) as unknown as T;
    const rows = Array.from(canvasElement.querySelectorAll('ep-settings-row')) as Array<HTMLElement & { updateComplete: Promise<unknown>; label: string; disabled: boolean }>;
    await Promise.all(rows.map((r) => r.updateComplete));

    // Disabled row → disabled control (keyboard too); re-enabling restores it.
    const c1 = $<EpCheckbox>('c1');
    await expect(c1.disabled).toBe(true);
    rows[0].disabled = false;
    await rows[0].updateComplete;
    await expect(c1.disabled).toBe(false);
    // A control the page disabled stays disabled.
    rows[4].disabled = false;
    await rows[4].updateComplete;
    await expect($<HTMLSelectElement>('s3').disabled).toBe(true);

    // Labels follow the row label, page labels are kept.
    await expect($<HTMLSelectElement>('s1').getAttribute('aria-label')).toBe('Font');
    rows[1].label = 'Schriftart';
    await rows[1].updateComplete;
    await expect($<HTMLSelectElement>('s1').getAttribute('aria-label')).toBe('Schriftart');
    await expect($<HTMLSelectElement>('s2').getAttribute('aria-label')).toBe('Page label');

    // The segmented control's radiogroup gets the row label.
    const g1 = $<EpSegmented>('g1');
    await g1.updateComplete;
    await expect(g1.shadowRoot!.querySelector('[role="radiogroup"]')!.getAttribute('aria-label')).toBe('Theme');
  },
};

export const SegmentedEdgeCases: StoryObj<Args> = {
  render: (args) => html`
    <ep-segmented id="none" @ep-change=${args.onChange}
      .options=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]}></ep-segmented>
    <ep-segmented id="off" disabled value="a" @ep-change=${args.onChange}
      .options=${[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]}></ep-segmented>`,
  play: async ({ canvasElement, args }) => {
    const none = canvasElement.querySelector('#none') as EpSegmented;
    await none.updateComplete;
    none.focus();
    await userEvent.keyboard('{ArrowLeft}');
    await expect(none.value).toBe('c');

    const off = canvasElement.querySelector('#off') as EpSegmented;
    await off.updateComplete;
    const radios = Array.from(off.shadowRoot!.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    await expect(radios.every((r) => r.disabled)).toBe(true);
    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await expect(off.value).toBe('a');
    await expect(args.onChange).toHaveBeenCalledTimes(1);
  },
};
