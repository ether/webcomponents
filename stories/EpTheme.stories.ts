import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, within } from 'storybook/test';
import { themes, EpTheme } from '../src/EpTheme.js';
import '../src/EpButton.js';
import '../src/EpCard.js';
import '../src/EpInput.js';
import '../src/EpCheckbox.js';
import '../src/EpNotification.js';
import '../src/EpUserBadge.js';
import '../src/EpChatMessage.js';
import '../src/EpColorPicker.js';
import '../src/EpDropdown.js';
import '../src/EpDropdownItem.js';

const themeNames = Object.keys(themes);

const meta: Meta = {
  title: 'Theme/EpTheme',
  component: 'ep-theme',
  argTypes: {
    name: { control: 'select', options: themeNames },
  },
  args: {
    name: 'colibris',
  },
};

export default meta;

type Story = StoryObj;

export const Showcase: Story = {
  render: (args) => html`
    <ep-theme name="${args.name}">
      <div style="padding: 24px; background: var(--bg-color); min-height: 100vh;">

        <h2 style="color: var(--text-color); font-family: var(--main-font-family); margin: 0 0 24px;">
          Theme: ${args.name}
        </h2>

        <ep-card card-title="Buttons" style="margin-bottom: 16px;">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <ep-button variant="default">Default</ep-button>
            <ep-button variant="primary">Primary</ep-button>
            <ep-button variant="ghost">Ghost</ep-button>
            <ep-button variant="icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
              </svg>
            </ep-button>
            <ep-button variant="primary" disabled>Disabled</ep-button>
          </div>
        </ep-card>

        <ep-card card-title="Form Elements" style="margin-bottom: 16px;">
          <div style="display: flex; flex-direction: column; gap: 16px; max-width: 320px;">
            <ep-input label="Name" placeholder="Enter your name..."></ep-input>
            <ep-input label="Email" type="email" placeholder="you@example.com"
                      hint="We'll never share your email."></ep-input>
            <ep-input label="Bio" type="textarea" placeholder="Tell us about yourself..."></ep-input>
            <ep-checkbox label="Show line numbers" checked></ep-checkbox>
            <ep-checkbox label="Enable chat"></ep-checkbox>
          </div>
        </ep-card>

        <ep-card card-title="Color Picker" style="margin-bottom: 16px;">
          <ep-color-picker></ep-color-picker>
        </ep-card>

        <ep-card card-title="Dropdown" style="margin-bottom: 16px;">
          <ep-dropdown trigger="click">
            <button slot="trigger" style="
              padding: 5px 20px; border-radius: 4px;
              border: 1px solid var(--middle-color, #d2d2d2);
              background: var(--bg-soft-color, #f2f3f4);
              color: var(--text-color, #485365);
              cursor: pointer; font-family: var(--main-font-family);
              font-weight: 700; text-transform: uppercase; font-size: 14px;
            ">Choose option</button>
            <div slot="content">
              <ep-dropdown-item value="a">Option A</ep-dropdown-item>
              <ep-dropdown-item value="b">Option B</ep-dropdown-item>
              <ep-dropdown-item value="c">Option C</ep-dropdown-item>
            </div>
          </ep-dropdown>
        </ep-card>

        <ep-card card-title="User List" style="margin-bottom: 16px;">
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <ep-user-badge name="Alice" color="#e57373" online></ep-user-badge>
            <ep-user-badge name="Bob" color="#64b5f6" online></ep-user-badge>
            <ep-user-badge name="Charlie" color="#81c784"></ep-user-badge>
          </div>
        </ep-card>

        <ep-card card-title="Chat" style="margin-bottom: 16px;">
          <div style="background: var(--bg-soft-color); border-radius: 4px; overflow: hidden;">
            <ep-chat-message author="Alice" author-color="#e57373" time="14:30">
              Has anyone reviewed the intro section?
            </ep-chat-message>
            <ep-chat-message author="Bob" author-color="#64b5f6" time="14:31">
              I'll take a look now.
            </ep-chat-message>
            <ep-chat-message author="You" author-color="#81c784" time="14:32" own>
              I already made some edits there.
            </ep-chat-message>
          </div>
        </ep-card>

        <ep-card card-title="Import / Export" subtitle="Share your document" bordered>
          <p style="margin: 0;">Export as HTML, plain text, or Word document.</p>
          <div slot="footer">
            <ep-button variant="primary">Export</ep-button>
            <ep-button variant="ghost">Cancel</ep-button>
          </div>
        </ep-card>

      </div>
    </ep-theme>
  `,
  play: async ({ canvasElement }) => {
    const theme = canvasElement.querySelector('ep-theme')! as EpTheme;
    await expect(theme.name).toBe('colibris');

    // Verify CSS variables are applied
    const style = getComputedStyle(theme);
    await expect(style.getPropertyValue('--bg-color').trim()).toBe('white');
    await expect(style.getPropertyValue('--text-color').trim()).toBe('#485365');
  },
};

export const SideBySide: Story = {
  render: () => html`
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
      ${themeNames.map(name => html`
        <ep-theme name="${name}">
          <div style="padding: 20px; background: var(--bg-color); min-height: 400px;">
            <h3 style="color: var(--text-color); font-family: var(--main-font-family); margin: 0 0 16px;">
              ${name}
            </h3>
            <ep-card card-title="Example" compact bordered style="margin-bottom: 12px;">
              <p style="margin: 0;">Card content in <strong>${name}</strong> theme.</p>
            </ep-card>
            <div style="display: flex; gap: 8px; margin-bottom: 12px;">
              <ep-button variant="default">Default</ep-button>
              <ep-button variant="primary">Primary</ep-button>
            </div>
            <ep-input placeholder="Type here..." style="max-width: 240px; margin-bottom: 12px;"></ep-input>
            <ep-checkbox label="Toggle option" checked></ep-checkbox>
          </div>
        </ep-theme>
      `)}
    </div>
  `,
  play: async ({ canvasElement }) => {
    const themeEls = canvasElement.querySelectorAll('ep-theme');
    await expect(themeEls.length).toBe(themeNames.length);

    // Verify each theme has a different --bg-color
    const bgColors = Array.from(themeEls).map(
      el => getComputedStyle(el).getPropertyValue('--bg-color').trim()
    );
    // colibris and high-contrast both use white, but dark ones don't
    const darkBg = bgColors.find(c => c !== 'white' && c !== '');
    await expect(darkBg).toBeTruthy();
  },
};

export const ThemeSwitching: Story = {
  render: () => html`
    <div>
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        ${themeNames.map(name => html`
          <button class="theme-switch" data-theme="${name}"
                  style="padding: 5px 12px; cursor: pointer;">${name}</button>
        `)}
      </div>
      <ep-theme name="colibris" id="switchable-theme">
        <div style="padding: 24px; background: var(--bg-color); border-radius: 5px; transition: background 0.3s ease;">
          <ep-card card-title="Dynamic Theme" bordered>
            <p style="margin: 0;">Click the buttons above to switch themes.</p>
            <div slot="footer">
              <ep-button variant="primary">Action</ep-button>
            </div>
          </ep-card>
        </div>
      </ep-theme>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const theme = canvasElement.querySelector('#switchable-theme')! as EpTheme;
    await expect(theme.name).toBe('colibris');

    // Wire up the buttons
    const buttons = canvasElement.querySelectorAll('.theme-switch');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        theme.name = (btn as HTMLElement).dataset.theme!;
      });
    });

    // Switch to dark
    theme.name = 'colibris-dark';
    await expect(theme.name).toBe('colibris-dark');
    await expect(getComputedStyle(theme).getPropertyValue('--bg-color').trim()).toBe('#2c3143');

    // Switch back
    theme.name = 'colibris';
    await expect(getComputedStyle(theme).getPropertyValue('--bg-color').trim()).toBe('white');
  },
};

export const RegisterCustomTheme: Story = {
  render: () => html`
    <ep-theme name="custom-ocean" id="custom-theme">
      <div style="padding: 24px; background: var(--bg-color); border-radius: 5px;">
        <ep-card card-title="Custom Theme">
          <p style="margin: 0;">A custom registered theme.</p>
          <div slot="footer">
            <ep-button variant="primary">Ocean Button</ep-button>
          </div>
        </ep-card>
      </div>
    </ep-theme>
  `,
  play: async ({ canvasElement }) => {
    // Register a custom theme
    EpTheme.registerTheme('custom-ocean', {
      '--bg-color': '#0d1b2a',
      '--bg-soft-color': '#1b2838',
      '--text-color': '#c9d6df',
      '--text-soft-color': '#8899a6',
      '--middle-color': '#2c3e50',
      '--dark-color': '#8899a6',
      '--super-dark-color': '#c9d6df',
      '--light-color': '#1b2838',
      '--super-light-color': '#0d1b2a',
      '--primary-color': '#48b5c4',
      '--main-font-family': '"SF Mono", Menlo, monospace',
    });

    const theme = canvasElement.querySelector('#custom-theme')! as EpTheme;
    // Force re-apply
    theme.name = 'custom-ocean';

    await expect(getComputedStyle(theme).getPropertyValue('--bg-color').trim()).toBe('#0d1b2a');
    await expect(getComputedStyle(theme).getPropertyValue('--primary-color').trim()).toBe('#48b5c4');
  },
};

export const Colibris: Story = {
  args: { name: 'colibris' },
  render: (args) => html`
    <ep-theme name="${args.name}">
      <div style="padding: 24px; background: var(--bg-color);">
        <ep-card card-title="Colibris (Default)">
          <p style="margin: 0;">The standard Etherpad look — light, clean, Quicksand font.</p>
          <div slot="footer">
            <ep-button variant="primary">Continue</ep-button>
          </div>
        </ep-card>
      </div>
    </ep-theme>
  `,
};

export const ColibrisDark: Story = {
  args: { name: 'colibris-dark' },
  render: (args) => html`
    <ep-theme name="${args.name}">
      <div style="padding: 24px; background: var(--bg-color);">
        <ep-card card-title="Colibris Dark">
          <p style="margin: 0;">Dark variant, same palette warmth as the original.</p>
          <div slot="footer">
            <ep-button variant="primary">Continue</ep-button>
          </div>
        </ep-card>
      </div>
    </ep-theme>
  `,
};

export const HighContrast: Story = {
  args: { name: 'high-contrast' },
  render: (args) => html`
    <ep-theme name="${args.name}">
      <div style="padding: 24px; background: var(--bg-color);">
        <ep-card card-title="High Contrast">
          <p style="margin: 0;">Accessibility-focused, strong contrast ratios.</p>
          <div slot="footer">
            <ep-button variant="primary">Continue</ep-button>
          </div>
        </ep-card>
      </div>
    </ep-theme>
  `,
};

export const Warm: Story = {
  args: { name: 'warm' },
  render: (args) => html`
    <ep-theme name="${args.name}">
      <div style="padding: 24px; background: var(--bg-color);">
        <ep-card card-title="Warm">
          <p style="margin: 0;">Warme Farbtöne, Serif-Font — für längere Texte.</p>
          <div slot="footer">
            <ep-button variant="primary">Continue</ep-button>
          </div>
        </ep-card>
      </div>
    </ep-theme>
  `,
};
