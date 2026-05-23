FROM node:20-alpine

WORKDIR /app

# Copy root package.json and workspace configs
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared types
COPY shared/ ./shared/

# Copy backend service
COPY backend/ ./backend/

# Install all dependencies
RUN npm install

# Build shared types first
RUN cd shared && npm install && npm run build

# Build backend
RUN cd backend && npm install && npm run build

WORKDIR /app/backend

EXPOSE 3000

CMD ["npm", "start"]
