
```
backend
├─ .agents
│  └─ skills
│     ├─ prisma-cli
│     │  ├─ references
│     │  │  ├─ agent-safety.md
│     │  │  ├─ complete.md
│     │  │  ├─ db-execute.md
│     │  │  ├─ db-pull.md
│     │  │  ├─ db-push.md
│     │  │  ├─ db-seed.md
│     │  │  ├─ debug.md
│     │  │  ├─ dev.md
│     │  │  ├─ format.md
│     │  │  ├─ generate.md
│     │  │  ├─ init.md
│     │  │  ├─ mcp.md
│     │  │  ├─ migrate-deploy.md
│     │  │  ├─ migrate-dev.md
│     │  │  ├─ migrate-diff.md
│     │  │  ├─ migrate-reset.md
│     │  │  ├─ migrate-resolve.md
│     │  │  ├─ migrate-status.md
│     │  │  ├─ studio.md
│     │  │  └─ validate.md
│     │  └─ SKILL.md
│     ├─ prisma-client-api
│     │  ├─ references
│     │  │  ├─ client-methods.md
│     │  │  ├─ constructor.md
│     │  │  ├─ filters.md
│     │  │  ├─ model-queries.md
│     │  │  ├─ query-options.md
│     │  │  ├─ raw-queries.md
│     │  │  ├─ relations.md
│     │  │  └─ transactions.md
│     │  └─ SKILL.md
│     ├─ prisma-compute
│     │  ├─ references
│     │  │  ├─ app-deploy-cli.md
│     │  │  ├─ compute-config.md
│     │  │  ├─ create-prisma.md
│     │  │  ├─ frameworks.md
│     │  │  ├─ sdk-api.md
│     │  │  └─ troubleshooting.md
│     │  └─ SKILL.md
│     ├─ prisma-database-setup
│     │  ├─ references
│     │  │  ├─ cockroachdb.md
│     │  │  ├─ mongodb.md
│     │  │  ├─ mysql.md
│     │  │  ├─ postgresql.md
│     │  │  ├─ prisma-client-setup.md
│     │  │  ├─ prisma-postgres.md
│     │  │  ├─ sqlite.md
│     │  │  └─ sqlserver.md
│     │  └─ SKILL.md
│     ├─ prisma-driver-adapter-implementation
│     │  └─ SKILL.md
│     ├─ prisma-mongodb-upgrade
│     │  ├─ references
│     │  │  ├─ client-api-mapping.md
│     │  │  ├─ decision-stay-or-migrate.md
│     │  │  ├─ migrations-mapping.md
│     │  │  ├─ schema-contract-mapping.md
│     │  │  └─ verify-cutover-checklist.md
│     │  └─ SKILL.md
│     ├─ prisma-postgres
│     │  ├─ references
│     │  │  ├─ console-and-connections.md
│     │  │  ├─ create-db-cli.md
│     │  │  ├─ management-api-sdk.md
│     │  │  └─ management-api.md
│     │  └─ SKILL.md
│     ├─ prisma-postgres-setup
│     │  ├─ references
│     │  │  ├─ api-basics.md
│     │  │  ├─ auth.md
│     │  │  ├─ endpoints.md
│     │  │  └─ prisma7-client.md
│     │  └─ SKILL.md
│     └─ prisma-upgrade-v7
│        ├─ references
│        │  ├─ accelerate-users.md
│        │  ├─ driver-adapters.md
│        │  ├─ env-variables.md
│        │  ├─ esm-support.md
│        │  ├─ prisma-config.md
│        │  ├─ removed-features.md
│        │  └─ schema-changes.md
│        └─ SKILL.md
├─ .codegraph
│  ├─ codegraph.db
│  ├─ codegraph.db-shm
│  ├─ codegraph.db-wal
│  ├─ daemon.log
│  └─ daemon.pid
├─ .dockerignore
├─ AGENTS.md
├─ api
│  └─ index.ts
├─ docker-compose.yml
├─ Dockerfile
├─ Dockerfile.production
├─ file.txt
├─ package-lock.json
├─ package.json
├─ prisma
│  ├─ migrations
│  │  ├─ 20260825000000_baseline
│  │  │  └─ migration.sql
│  │  ├─ 2026082501000000_remove_product_kode
│  │  │  └─ migration.sql
│  │  ├─ 2026082502000000_remove_productvariant_status
│  │  │  └─ migration.sql
│  │  ├─ 2026082503000000_add_barang_and_variant_code
│  │  │  └─ migration.sql
│  │  ├─ 20260825220000_add_production_batch
│  │  │  └─ migration.sql
│  │  ├─ 20260826000000_add_view_variant_produk
│  │  │  └─ migration.sql
│  │  ├─ 20260826100000_add_status_register
│  │  │  └─ migration.sql
│  │  ├─ 20260827111248_add_tanggal_to_barang
│  │  │  └─ migration.sql
│  │  ├─ 20260829050139_make_batch_nullable
│  │  │  └─ migration.sql
│  │  └─ migration_lock.toml
│  ├─ schema.prisma
│  └─ seed.ts
├─ prisma.config.ts
├─ README.md
├─ skills-lock.json
├─ src
│  ├─ app.ts
│  ├─ controller
│  │  ├─ auth
│  │  │  └─ auth.ts
│  │  ├─ barang
│  │  │  └─ barang.ts
│  │  ├─ product
│  │  │  └─ product.ts
│  │  ├─ user
│  │  └─ variantproduk
│  │     └─ variantproduk.ts
│  ├─ lib
│  │  ├─ barang.ts
│  │  ├─ jwt.ts
│  │  ├─ prisma.ts
│  │  ├─ redis.ts
│  │  └─ tokenBlacklist.ts
│  ├─ middleware
│  │  └─ auth.ts
│  ├─ model
│  │  ├─ barang
│  │  │  └─ barang.ts
│  │  ├─ product
│  │  │  └─ product.ts
│  │  ├─ user
│  │  │  └─ user.ts
│  │  └─ variantproduk
│  │     └─ variantproduk.ts
│  ├─ routes
│  │  ├─ auth.ts
│  │  ├─ barang.ts
│  │  ├─ products.ts
│  │  └─ variant-produk.ts
│  └─ websocket
│     └─ socket.ts
├─ tests
│  ├─ auth.test.ts
│  ├─ barang.test.ts
│  └─ variantproduk.test.ts
├─ test_api.http
├─ tsconfig.json
├─ update.md
├─ vercel.json
└─ vitest.config.ts

```