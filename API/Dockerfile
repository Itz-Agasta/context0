FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:22-slim AS final

WORKDIR /app

COPY package*.json ./

RUN npm i --only=production

COPY --from=base /app/dist ./dist
COPY dev-wallet.json ./
COPY data/ ./data/


EXPOSE 3000

CMD ["node", "dist/server.js"]
