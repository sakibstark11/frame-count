FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# Install mediainfo
RUN apt-get update && apt-get install -y \
    mediainfo \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]