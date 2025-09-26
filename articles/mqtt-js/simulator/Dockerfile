FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY simulator/ simulator/

CMD ["node", "simulator/index.js"]
