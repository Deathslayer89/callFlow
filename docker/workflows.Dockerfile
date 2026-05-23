FROM node:20-alpine

WORKDIR /app

# Copy root package.json and workspace configs
COPY package*.json ./
COPY tsconfig.json ./

# Copy shared types
COPY shared/ ./shared/

# Copy workflows service
COPY workflows/ ./workflows/

# Install all dependencies
RUN npm install

# Build shared types first
RUN cd shared && npm install && npm run build

# Build workflows
RUN cd workflows && npm install && npm run build

WORKDIR /app/workflows

CMD ["npm", "start"]
