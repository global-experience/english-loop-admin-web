.PHONY: dev prod down

dev:
	docker compose -f compose.yaml -f docker-compose.dev.yml up --build

prod:
	docker compose -f compose.yaml up --build

down:
	docker compose -f compose.yaml -f docker-compose.dev.yml down
