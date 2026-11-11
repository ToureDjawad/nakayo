// Front branché sur la vraie API (port 3100) au lieu des mocks. Lancement : voir tests/reel/README.md.
import config from './vite.config.js'
export default { ...config, server: { proxy: { '/api': 'http://127.0.0.1:3100' } } }
