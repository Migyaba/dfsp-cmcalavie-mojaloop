FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache tini

# Install dependencies and build
COPY package*.json ./
RUN npm ci

COPY src ./src
COPY tsconfig.json vite.config.ts ./
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Make CLI globally available
RUN npm link

RUN mkdir -p /etc/mcm-agent

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
