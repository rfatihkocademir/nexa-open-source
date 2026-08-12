FROM node:22-bookworm-slim AS backend-build

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci

COPY backend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS backend

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=backend-build --chown=node:node /app/prisma ./prisma
COPY --from=backend-build --chown=node:node /app/node_modules ./node_modules
COPY --from=backend-build --chown=node:node /app/dist ./dist

RUN mkdir -p /app/public/videos /app/automation-runtime \
    && chown -R node:node /app/public /app/automation-runtime

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]

FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine AS frontend

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
