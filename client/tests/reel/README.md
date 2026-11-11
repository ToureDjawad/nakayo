# Parcours sur la vraie API

Ces tests passent par le vrai front et la vraie API, sans mocks. Ils ne tournent pas en CI : ils demandent une API démarrée avec une base dédiée.

```bash
# 1. Base dédiée (ici dans le conteneur de test, port 5433)
docker compose exec db-test psql -U nakayo -d nakayo_test -c "DROP DATABASE IF EXISTS nakayo_integration" -c "CREATE DATABASE nakayo_integration"

# 2. API sur le port 3100, journal dans un fichier (les liens et codes SMS y sont écrits)
cd server
export DATABASE_URL=postgres://nakayo:nakayo@localhost:5433/nakayo_integration
node src/db/migrate.js
NAKAYO_ADMIN_MOT_DE_PASSE=admin-nakayo-2026 node src/scripts/creer-admin.js --email admin@nakayo.bj
CLIENT_URL=http://127.0.0.1:5180 CONTROLES_RESEAU=false PORT=3100 node src/index.js > /tmp/api-nakayo.log 2>&1 &

# 3. Front branché sur cette API, puis les tests
cd ../client
npx vite --config vite.integration.config.js --port 5180 --strictPort --host 127.0.0.1 &
JOURNAL_API=/tmp/api-nakayo.log npm run test:e2e:reel
```

Les tests partent d'une base vide : recréer la base avant chaque lancement.
