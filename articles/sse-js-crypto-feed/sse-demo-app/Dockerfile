# Dockerfile in sse-demo-app/

FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies
COPY sse-demo-app/package*.json ./
RUN npm install

# Copy backend source
COPY sse-demo-app ./

# Copy frontend files into public directory
COPY frontend ./public

# Expose port and start server
EXPOSE 3000
CMD ["npm", "start"]
