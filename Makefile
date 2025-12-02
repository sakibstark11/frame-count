# Variables
COMPOSE_FILE = docker-compose.yml
SERVICE_NAME = frame-count-api

# Default target
.DEFAULT_GOAL := help

# Help target
help:
	@echo "Available commands:"
	@echo "  up          - Start the development server in background"
	@echo "  down        - Stop the development server"
	@echo "  restart     - Restart the development server"
	@echo "  logs        - Show server logs"
	@echo "  shell       - Open shell in running container"
	@echo "  install     - Install dependencies in container"
	@echo "  build       - Build TypeScript code in container"
	@echo "  lint        - Run linting in container"
	@echo "  test        - Run tests in container"
	@echo "  test-watch  - Run tests in watch mode in container"
	@echo "  typecheck   - Run TypeScript type checking in container"
	@echo "  clean       - Stop containers and remove volumes"

# Start development server in background
up:
	docker compose -f $(COMPOSE_FILE) up -d

# Stop development server
down:
	docker compose -f $(COMPOSE_FILE) down

# Restart development server
restart: down up

# Show logs
logs:
	docker compose -f $(COMPOSE_FILE) logs -f $(SERVICE_NAME)

# Open shell in running container
shell:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) /bin/bash

# Install dependencies in container
install:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) npm install

# Build TypeScript code in container
build:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) npm run build

# Run linting in container
lint:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) npm run lint

# Run tests in container
test:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) npm test

# Run tests in watch mode in container
test-watch:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) npm run test:watch

# Run TypeScript type checking in container
typecheck:
	docker compose -f $(COMPOSE_FILE) exec $(SERVICE_NAME) npm run typecheck

# Clean up
clean:
	docker compose -f $(COMPOSE_FILE) down -v
	docker system prune -f

.PHONY: help up down restart logs shell install build lint test test-watch typecheck clean