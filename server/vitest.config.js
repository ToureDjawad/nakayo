import { defineConfig } from 'vitest/config'

// Les tests d'intégration et de bout en bout utilisent une vraie base PostgreSQL,
// remise à zéro au démarrage. Ne jamais pointer DATABASE_URL_TEST vers une base utile.
const baseDeTest = process.env.DATABASE_URL_TEST ?? 'postgres://nakayo:nakayo@localhost:5433/nakayo_test'

export default defineConfig({
  test: {
    env: { DATABASE_URL: baseDeTest, NODE_ENV: 'test' },
    globalSetup: ['./tests/preparer-base.js'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
