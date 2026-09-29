import { defineConfig } from 'astro/config';
import brand from '@undrwrldcub/brand';

export default defineConfig({
  site: 'https://undrwrldcub.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [brand()],
});
