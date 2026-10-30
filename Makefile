setup:
	npm ci
	npm exec tsx scripts/configure.ts
	docker compose up -d postgres redis minio clamav mailpit
	npm run db:generate
	npm run db:migrate
	npm run db:seed
check:
	npm run lint
	npm run typecheck
	npm test
dev:
	npm run dev
