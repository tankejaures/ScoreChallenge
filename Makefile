API_DIR := api
WEB_DIR := web

.DEFAULT_GOAL := help

## ----- Aide -----

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

## ----- Installation -----

install: ## Installe les dépendances
	cd $(API_DIR) && npm install
	cd $(WEB_DIR) && npm install

## ----- Infrastructure -----

db-start: ## Démarre PostgreSQL + Mailhog
	docker compose up -d

db-stop: ## Arrête les conteneurs
	docker compose down

db-migrate: ## Applique les migrations Prisma
	cd $(API_DIR) && npx prisma migrate dev

db-test-create: ## Crée la base de test
	docker compose exec postgres createdb -U scorechallenge scorechallenge_test || true

## ----- Développement -----

dev-api: ## Lance l'API en mode watch
	cd $(API_DIR) && npm run start:dev

dev-web: ## Lance le frontend Angular (proxy vers l'API)
	cd $(WEB_DIR) && npm start

## ----- Tests -----

test-api: ## Tests unitaires API
	cd $(API_DIR) && npm test

test-e2e: ## Tests e2e API
	cd $(API_DIR) && npm run test:e2e

test-web: ## Tests unitaires web (vitest)
	cd $(WEB_DIR) && npm test -- --no-watch

test: test-api test-e2e test-web ## Tous les tests

## ----- Build -----

build: ## Build api + web
	cd $(API_DIR) && npm run build
	cd $(WEB_DIR) && npm run build

## ----- État -----

status: ## État des services Docker
	docker compose ps
