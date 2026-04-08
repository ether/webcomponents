import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn, waitFor } from 'storybook/test';
import '../src/EpColorWheel.js';
import type { EpColorWheel } from '../src/EpColorWheel.js';

async function ready(canvasElement: HTMLElement): Promise<EpColorWheel> {
  await customElements.whenDefined('ep-color-wheel');
  const host = canvasElement.querySelector('ep-color-wheel')! as EpColorWheel;
  // Wait until shadow root exists
  await waitFor(() => {
    if (!host.shadowRoot) throw new Error('No shadow root yet');
  }, { timeout: 3000 });
  await host.updateComplete;
  return host;
}

const meta: Meta = {
  title: 'Components/EpColorWheel',
  component: 'ep-color-wheel',
  argTypes: {
    size: { control: { type: 'range', min: 120, max: 400, step: 10 } },
    value: { control: 'color' },
    showInput: { control: 'boolean' },
  },
  args: {
    size: 200,
    value: '#485365',
    showInput: true,
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => html`
    <ep-color-wheel
      size="${args.size}"
      value="${args.value}"
      ?show-input="${args.showInput}"
    ></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);

    const mask = host.shadowRoot!.querySelector('.mask') as HTMLCanvasElement;
    const overlay = host.shadowRoot!.querySelector('.overlay') as HTMLCanvasElement;
    await expect(mask).not.toBe(null);
    await expect(overlay).not.toBe(null);
    await expect(mask.width).toBe(200);
    await expect(overlay.width).toBe(200);

    const solid = host.shadowRoot!.querySelector('.solid');
    await expect(solid).not.toBe(null);

    const input = host.shadowRoot!.querySelector('.hex-input') as HTMLInputElement;
    await expect(input).not.toBe(null);
    await expect(input.value.toLowerCase()).toBe('#485365');
  },
};

export const SetColorProgrammatically: Story = {
  render: () => html`
    <ep-color-wheel size="200" value="#e57373"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    await expect(host.value.toLowerCase()).toBe('#e57373');

    host.value = '#64b5f6';
    await host.updateComplete;
    await expect(host.value.toLowerCase()).toBe('#64b5f6');

    host.setHSL(0.33, 0.8, 0.5);
    await host.updateComplete;
    const hsl = host.getHSL();
    await expect(Math.abs(hsl[0] - 0.33)).toBeLessThan(0.01);
    await expect(Math.abs(hsl[1] - 0.8)).toBeLessThan(0.01);
    await expect(Math.abs(hsl[2] - 0.5)).toBeLessThan(0.01);
  },
};

export const HexInputChange: Story = {
  render: () => html`
    <ep-color-wheel size="200" value="#485365"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const handler = fn();
    host.addEventListener('ep-color-change', handler);

    const input = host.shadowRoot!.querySelector('.hex-input') as HTMLInputElement;

    await userEvent.clear(input);
    await userEvent.type(input, '#ff0000');
    await userEvent.keyboard('{Enter}');

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    await expect(host.value.toLowerCase()).toBe('#ff0000');
  },
};

export const ClickOnWheel: Story = {
  render: () => html`
    <ep-color-wheel size="200" value="#485365"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const handler = fn();
    host.addEventListener('ep-color-change', handler);

    const overlay = host.shadowRoot!.querySelector('.overlay') as HTMLCanvasElement;
    const rect = overlay.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const topY = rect.top + 10;

    overlay.dispatchEvent(new MouseEvent('mousedown', {
      clientX: centerX,
      clientY: topY,
      bubbles: true,
    }));

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });

    const hsl = host.getHSL();
    await expect(hsl[0]).toBeLessThan(0.05);
  },
};

export const ClickOnSquare: Story = {
  render: () => html`
    <ep-color-wheel size="200" value="#808080"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const handler = fn();
    host.addEventListener('ep-color-change', handler);

    const overlay = host.shadowRoot!.querySelector('.overlay') as HTMLCanvasElement;
    const rect = overlay.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const middle = rect.top + rect.height / 2;

    overlay.dispatchEvent(new MouseEvent('mousedown', {
      clientX: center,
      clientY: middle,
      bubbles: true,
    }));

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    await waitFor(() => {
      expect(handler).toHaveBeenCalled();
    });
  },
};

export const WithoutInput: Story = {
  args: { showInput: false },
  render: (args) => html`
    <ep-color-wheel size="${args.size}" value="${args.value}"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const input = host.shadowRoot!.querySelector('.hex-input');
    await expect(input).toBe(null);
  },
};

export const SmallSize: Story = {
  args: { size: 140 },
  render: (args) => html`
    <ep-color-wheel size="${args.size}" value="#64d29b"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const mask = host.shadowRoot!.querySelector('.mask') as HTMLCanvasElement;
    await expect(mask.width).toBe(140);
  },
};

export const LargeSize: Story = {
  args: { size: 320 },
  render: (args) => html`
    <ep-color-wheel size="${args.size}" value="#c47a4a"></ep-color-wheel>
  `,
  play: async ({ canvasElement }) => {
    const host = await ready(canvasElement);
    const mask = host.shadowRoot!.querySelector('.mask') as HTMLCanvasElement;
    await expect(mask.width).toBe(320);
  },
};

export const Themed: Story = {
  render: () => html`
    <div style="display: flex; gap: 32px;">
      <div>
        <h4 style="margin: 0 0 8px; color: var(--text-color, #485365); font-family: var(--main-font-family);">
          Light
        </h4>
        <ep-color-wheel size="180" value="#64d29b"></ep-color-wheel>
      </div>
      <div style="background: #2c3143; padding: 16px; border-radius: 8px;
                  --bg-soft-color: #363b50; --text-color: #e4e6eb;
                  --middle-color: #4a5068; --dark-color: #a8adb8;">
        <h4 style="margin: 0 0 8px; color: var(--text-color); font-family: var(--main-font-family);">
          Dark
        </h4>
        <ep-color-wheel size="180" value="#64d29b"></ep-color-wheel>
      </div>
    </div>
  `,
};

export const SideBySideWithPicker: Story = {
  render: () => html`
    <div style="display: flex; gap: 24px; align-items: flex-start;">
      <div>
        <h4 style="margin: 0 0 8px; color: var(--text-color, #485365); font-family: var(--main-font-family);">
          Color Wheel (precise)
        </h4>
        <ep-color-wheel size="200" value="#e57373"></ep-color-wheel>
      </div>
      <div>
        <h4 style="margin: 0 0 8px; color: var(--text-color, #485365); font-family: var(--main-font-family);">
          Color Picker (swatches)
        </h4>
        <ep-color-picker value="red"></ep-color-picker>
      </div>
    </div>
  `,
};
