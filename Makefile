.PHONY: quickstart dev build lint test deploy help

NODE_VERSION := 22

quickstart: ## Install dependencies, set up environment, and start the dev server
	@echo ""
	@echo "═══════════════════════════════════════════════════════════════"
	@echo "  VantaOS Cloud IDE — One-command quickstart"
	@echo "═══════════════════════════════════════════════════════════════"
	@echo ""
	@if [ ! -d node_modules ]; then \
		echo "→ Installing dependencies (npm ci)..."; \
		npm ci; \
	else \
		echo "→ Dependencies already installed (node_modules exists)"; \
	fi
	@if [ ! -f .env.local ] && [ ! -f .env ]; then \
		echo "→ Creating .env.local from .env.example (demo mode — no Firebase needed)"; \
		cp .env.example .env.local; \
	else \
		echo "→ Environment already configured (.env.local or .env exists)"; \
	fi
	@echo ""
	@echo "Starting dev server at http://localhost:3000"
	@echo "Press Ctrl+C to stop"
	@echo ""
	npm run dev

dev: ## Start the dev server (next dev)
	npm run dev

build: ## Production build
	npm run build

lint: ## Type-check
	npm run lint

test: ## Run tests
	npm test

deploy: ## Deploy to Cloudflare Workers
	npm run deploy

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
