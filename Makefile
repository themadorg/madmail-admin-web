# Madmail admin web (SvelteKit) — local development
.PHONY: dev init build preview check help

# Vite dev server (default http://127.0.0.1:5173)
dev: init
	@if command -v bun >/dev/null 2>&1; then \
		exec bun run dev; \
	elif command -v npm >/dev/null 2>&1; then \
		exec npm run dev; \
	else \
		echo "Install bun or npm to run the dev server."; exit 1; \
	fi

init:
	@if [ ! -d node_modules ]; then \
		if command -v bun >/dev/null 2>&1; then \
			bun install; \
		elif command -v npm >/dev/null 2>&1; then \
			npm install; \
		else \
			echo "Install bun or npm first."; exit 1; \
		fi; \
	fi

build: init
	@if command -v bun >/dev/null 2>&1; then bun run build; else npm run build; fi

preview: build
	@if command -v bun >/dev/null 2>&1; then bun run preview; else npm run preview; fi

check: init
	@if command -v bun >/dev/null 2>&1; then bun run check; else npm run check; fi

help:
	@echo "madmail-admin-web"
	@echo ""
	@echo "  make dev      — Vite dev server (copy .env.example → .env for API proxy)"
	@echo "  make init     — bun/npm install if node_modules is missing"
	@echo "  make build    — production static build → build/"
	@echo "  make preview  — serve production build locally"
	@echo "  make check    — svelte-check"
