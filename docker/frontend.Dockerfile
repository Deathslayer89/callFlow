FROM node:20-alpine

WORKDIR /app

# Copy root package.json
COPY package*.json ./

# Copy frontend service
COPY frontend/ ./frontend/

# Install dependencies
RUN npm install

WORKDIR /app/frontend

RUN npm install

EXPOSE 3000

CMD ["npm", "run", "dev"]
