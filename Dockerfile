FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY server/package*.json ./server/

# Copy scripts required by postinstall
COPY server/scripts ./server/scripts

# Install dependencies
RUN npm ci --prefix server

# Copy application
COPY server ./server
COPY client ./client

RUN npm run prisma:generate --prefix server

EXPOSE 8080

CMD ["npm", "start", "--prefix", "server"]