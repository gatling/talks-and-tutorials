FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend/ backend/

EXPOSE 8080
CMD ["node", "backend/index.js"]
