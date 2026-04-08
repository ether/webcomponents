import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.ts'],
  addons: ['@storybook/addon-vitest'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
};

export default config;
