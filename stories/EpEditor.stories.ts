import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import { expect } from 'storybook/test';
import '../src/EpEditor.js';
import type { EpEditor } from '../src/EpEditor.js';

type EpEditorArgs = {
  content: string;
  readonly: boolean;
  wrap: boolean;
  authorId: string;
};

const meta: Meta<EpEditorArgs> = {
  title: 'Components/EpEditor',
  component: 'ep-editor',
  argTypes: {
    content: { control: 'text' },
    readonly: { control: 'boolean' },
    wrap: { control: 'boolean' },
    authorId: { control: 'text' },
  },
  args: {
    content: '',
    readonly: false,
    wrap: true,
    authorId: '',
  },
};

export default meta;

type Story = StoryObj<EpEditorArgs>;

async function getEditor(canvasElement: HTMLElement): Promise<EpEditor> {
  const host = canvasElement.querySelector('ep-editor') as EpEditor;
  // Wait for the ready event or a short timeout
  if (!host.editor) {
    await new Promise<void>((resolve) => {
      host.addEventListener('ready', () => resolve(), { once: true });
      setTimeout(resolve, 2000);
    });
  }
  return host;
}

export const Default: Story = {
  render: (args: EpEditorArgs) => html`
    <ep-editor
      style="height: 300px; border: 1px solid #ccc; border-radius: 4px;"
      .content="${args.content}"
      ?readonly="${args.readonly}"
      ?wrap="${args.wrap}"
      author-id="${args.authorId}"
    ></ep-editor>
  `,
  play: async ({ canvasElement }) => {
    const editor = await getEditor(canvasElement);
    await expect(editor).not.toBe(null);
  },
};

export const WithInitialContent: Story = {
  args: {
    content: 'Hello, this is the Etherpad Ace Editor.\nIt supports rich text editing.\n\nTry formatting with Ctrl+B, Ctrl+I, Ctrl+U.',
  },
  render: (args: EpEditorArgs) => html`
    <ep-editor
      style="height: 300px; border: 1px solid #ccc; border-radius: 4px;"
      .content="${args.content}"
    ></ep-editor>
  `,
};

export const ReadOnly: Story = {
  args: {
    content: 'This editor is read-only.\nYou cannot edit this text.',
    readonly: true,
  },
  render: (args: EpEditorArgs) => html`
    <ep-editor
      style="height: 200px; border: 1px solid #ccc; border-radius: 4px;"
      .content="${args.content}"
      ?readonly="${args.readonly}"
    ></ep-editor>
  `,
};

export const CustomStyling: Story = {
  args: {
    content: 'This editor uses custom CSS properties for styling.',
  },
  render: (args: EpEditorArgs) => html`
    <ep-editor
      style="
        height: 250px;
        border: 2px solid #0366d6;
        border-radius: 8px;
        --ep-editor-font: 'Georgia', serif;
        --ep-editor-font-size: 16px;
        --ep-editor-line-height: 1.8;
        --ep-editor-color: #1a1a2e;
        --ep-editor-bg: #f8f9fa;
        --ep-editor-padding: 16px 20px;
      "
      .content="${args.content}"
    ></ep-editor>
  `,
};

export const WithToolbar: Story = {
  args: {
    content: 'Select text and use the toolbar buttons above to format it.',
  },
  render: (args: EpEditorArgs) => html`
    <div style="border: 1px solid #ccc; border-radius: 4px; overflow: hidden;">
      <div style="display: flex; gap: 4px; padding: 6px 8px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5;">
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.toggleFormat('bold');
        }}" style="font-weight: bold; padding: 4px 8px; cursor: pointer;">B</button>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.toggleFormat('italic');
        }}" style="font-style: italic; padding: 4px 8px; cursor: pointer;">I</button>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.toggleFormat('underline');
        }}" style="text-decoration: underline; padding: 4px 8px; cursor: pointer;">U</button>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.toggleFormat('strikethrough');
        }}" style="text-decoration: line-through; padding: 4px 8px; cursor: pointer;">S</button>
        <span style="border-left: 1px solid #ccc; margin: 0 4px;"></span>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.insertUnorderedList();
        }}" style="padding: 4px 8px; cursor: pointer;">UL</button>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.insertOrderedList();
        }}" style="padding: 4px 8px; cursor: pointer;">OL</button>
        <span style="border-left: 1px solid #ccc; margin: 0 4px;"></span>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.undo();
        }}" style="padding: 4px 8px; cursor: pointer;">Undo</button>
        <button @click="${(e: Event) => {
          const editor = (e.target as HTMLElement).closest('div')!.parentElement!.querySelector('ep-editor') as EpEditor;
          editor?.redo();
        }}" style="padding: 4px 8px; cursor: pointer;">Redo</button>
      </div>
      <ep-editor
        style="height: 250px;"
        .content="${args.content}"
      ></ep-editor>
    </div>
  `,
};

export const EventDemo: Story = {
  args: {
    content: 'Type here and watch the events below.',
  },
  render: (args: EpEditorArgs) => html`
    <div>
      <ep-editor
        style="height: 200px; border: 1px solid #ccc; border-radius: 4px;"
        .content="${args.content}"
        @content-changed="${(e: CustomEvent) => {
          const log = document.getElementById('event-log');
          if (log) {
            const lines = e.detail.text.split('\n').length;
            const chars = e.detail.text.length;
            log.textContent = `Content changed: ${lines} lines, ${chars} chars`;
          }
        }}"
        @selection-changed="${(e: CustomEvent) => {
          const log = document.getElementById('selection-log');
          if (log) {
            log.textContent = `Selection: [${e.detail.selStart}] to [${e.detail.selEnd}]`;
          }
        }}"
      ></ep-editor>
      <div style="margin-top: 8px; padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px;">
        <div id="event-log">Content changed: --</div>
        <div id="selection-log">Selection: --</div>
      </div>
    </div>
  `,
};

export const Monospace: Story = {
  args: {
    content: 'function hello() {\n  console.log("Hello, world!");\n}\n\nhello();',
  },
  render: (args: EpEditorArgs) => html`
    <ep-editor
      style="
        height: 250px;
        border: 1px solid #ccc;
        border-radius: 4px;
        --ep-editor-font: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        --ep-editor-font-size: 13px;
        --ep-editor-line-height: 1.5;
        --ep-editor-bg: #1e1e1e;
        --ep-editor-color: #d4d4d4;
        --ep-editor-padding: 12px 16px;
      "
      .content="${args.content}"
    ></ep-editor>
  `,
};
