FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye AS dev

RUN apt-get update && apt-get install -y \
    mediainfo \
    && rm -rf /var/lib/apt/lists/*


USER node

WORKDIR /app

COPY --chown=node:node package*.json ./

RUN npm install

COPY --chown=node:node . .

EXPOSE 3000

# Build stage
FROM dev AS build

USER node

RUN npm run build

# Production stage
FROM node:22-bullseye-slim AS prod

ENV NODE_ENV=production

USER node

WORKDIR /app

COPY --chown=node:node package*.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.js"]
