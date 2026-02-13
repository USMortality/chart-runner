FROM rocker/r2u:noble

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Install MinIO client
RUN curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
    && chmod +x /usr/local/bin/mc

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy app source
COPY . .

# Build Nuxt
RUN bun run build

# Run migrations at startup via the server plugin
EXPOSE 5000

ENV HOST=0.0.0.0
ENV PORT=5000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
