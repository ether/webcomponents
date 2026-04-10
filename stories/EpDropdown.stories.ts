import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, userEvent, fn } from 'storybook/test';
import '../src/EpDropdown.js';
import '../src/EpDropdownItem.js';

type EpDropdownArgs = {
  trigger: 'click' | 'hover';
  align: 'left' | 'right';
};

const meta: Meta<EpDropdownArgs> = {
  title: 'Components/EpDropdown',
  component: 'ep-dropdown',
  argTypes: {
    trigger: { control: 'select', options: ['click', 'hover'] },
    align: { control: 'select', options: ['left', 'right'] },
  },
  args: {
    trigger: 'click',
    align: 'left',
  },
};

export default meta;

type Story = StoryObj<EpDropdownArgs>;

export const Default: Story = {
  render: (args: EpDropdownArgs) => html`
    <ep-dropdown trigger="${args.trigger}" align="${args.align}">
      <button slot="trigger" style="padding: 8px 16px; cursor: pointer;">
        Choose option
      </button>
      <div slot="content">
        <ep-dropdown-item value="a">Option A</ep-dropdown-item>
        <ep-dropdown-item value="b">Option B</ep-dropdown-item>
        <ep-dropdown-item value="c">Option C</ep-dropdown-item>
      </div>
    </ep-dropdown>
  `,
  play: async ({ canvasElement }) => {
    const dropdown = canvasElement.querySelector('ep-dropdown')!;
    await dropdown.updateComplete;

    // Initially closed
    await expect(dropdown.open).toBe(false);

    // Click to open — trigger button is in light DOM (slotted)
    const trigger = canvasElement.querySelector('[slot="trigger"]')!;
    await userEvent.click(trigger);
    await expect(dropdown.open).toBe(true);

    // Items visible
    const items = canvasElement.querySelectorAll('ep-dropdown-item');
    await expect(items.length).toBe(3);
  },
};

export const SelectItem: Story = {
  render: () => html`
    <ep-dropdown trigger="click">
      <button slot="trigger" style="padding: 8px 16px; cursor: pointer;">
        Pick one
      </button>
      <div slot="content">
        <ep-dropdown-item value="alpha">Alpha</ep-dropdown-item>
        <ep-dropdown-item value="beta">Beta</ep-dropdown-item>
      </div>
    </ep-dropdown>
  `,
  play: async ({ canvasElement }) => {
    const dropdown = canvasElement.querySelector('ep-dropdown')!;
    await dropdown.updateComplete;
    const handler = fn();
    dropdown.addEventListener('ep-dropdown-select', handler);

    // Open
    const trigger = canvasElement.querySelector('[slot="trigger"]')!;
    await userEvent.click(trigger);
    await expect(dropdown.open).toBe(true);

    // Select item
    const betaItem = canvasElement.querySelector('ep-dropdown-item[value="beta"]')!;
    await userEvent.click(betaItem);

    await expect(handler).toHaveBeenCalledTimes(1);
    // Should close after selection
    await expect(dropdown.open).toBe(false);
  },
};

export const WithDisabledItem: Story = {
  render: () => html`
    <ep-dropdown trigger="click">
      <button slot="trigger" style="padding: 8px 16px; cursor: pointer;">
        Font Size
      </button>
      <div slot="content">
        <ep-dropdown-item value="12">12px</ep-dropdown-item>
        <ep-dropdown-item value="14">14px</ep-dropdown-item>
        <ep-dropdown-item value="16" disabled>16px (disabled)</ep-dropdown-item>
        <ep-dropdown-item value="18">18px</ep-dropdown-item>
      </div>
    </ep-dropdown>
  `,
  play: async ({ canvasElement }) => {
    const disabledItem = canvasElement.querySelector('ep-dropdown-item[disabled]')!;
    await expect(disabledItem.hasAttribute('disabled')).toBe(true);
  },
};

export const HoverTrigger: Story = {
  args: { trigger: 'hover' },
  render: (args: EpDropdownArgs) => html`
    <ep-dropdown trigger="${args.trigger}">
      <button slot="trigger" style="padding: 8px 16px; cursor: pointer;">
        Hover me
      </button>
      <div slot="content">
        <ep-dropdown-item value="1">Item 1</ep-dropdown-item>
        <ep-dropdown-item value="2">Item 2</ep-dropdown-item>
        <ep-dropdown-item value="3">Item 3</ep-dropdown-item>
      </div>
    </ep-dropdown>
  `,
};
