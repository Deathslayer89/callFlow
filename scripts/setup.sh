#!/bin/bash

set -e

echo "🚀 Setting up CallFlow development environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"
echo "✅ Docker version: $(docker --version)"

# Install root dependencies
echo ""
echo "📦 Installing root dependencies..."
npm install

# Start Docker services
echo ""
echo "🐳 Starting Docker services (Postgres, Redis)..."
docker-compose -f docker/docker-compose.yml up -d postgres redis

# Wait for Postgres to be ready
echo ""
echo "⏳ Waiting for Postgres to be ready..."
until docker exec callflow-postgres pg_isready -U callflow > /dev/null 2>&1; do
  sleep 1
  echo "   Still waiting..."
done
echo "✅ Postgres is ready!"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
cd backend && npx prisma generate && cd ..

# Run database migrations
echo ""
echo "🗄️  Running database migrations..."
cd backend && npx prisma migrate dev --name init && cd ..

# Install other service dependencies
echo ""
echo "📦 Installing other service dependencies..."
cd agent && npm install && cd ..
cd workflows && npm install && cd ..
cd frontend && npm install && cd ..
cd shared && npm install && cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to backend/.env and add your API keys"
echo "  2. Run 'npm run dev:all' to start all services"
echo "  3. Visit http://localhost:3001 for the dashboard"
echo ""
echo "Individual services:"
echo "  - Backend API: npm run dev:backend (http://localhost:3000)"
echo "  - Frontend: npm run dev:frontend (http://localhost:3001)"
echo "  - Workflows: npm run dev:workflows"
echo ""
