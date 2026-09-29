import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://undrwrldcub.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
