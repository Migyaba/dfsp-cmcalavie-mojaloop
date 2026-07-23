import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'node22',
    outDir: 'dist',
    lib: {
      entry: {
        index: './src/index.ts',
        cli: './src/cli.ts',
        'tui/index': './src/tui/index.tsx',
      },
      formats: ['es'],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        /^node:.*/,
        /^@mojaloop\//,
        'fastify',
        'axios',
        'pino',
        'pino-pretty',
        'yaml',
        'zod',
        'dotenv',
        'env-var',
        'ink',
        'ink-select-input',
        'ink-text-input',
        'react',
        'figures',
      ],
    },
    ssr: true,
    minify: false,
  },
  resolve: {
    alias: {
      '~': '/src',
    },
  },
});
