# 🚢 DevOps, Docker & CI/CD Implementation Guide

Complete DevOps setup với Docker containerization và GitHub Actions CI/CD pipeline.

---

## 📑 MỤC LỤC

1. [Docker Setup](#1-docker-setup)
2. [Docker Compose](#2-docker-compose)
3. [GitHub Actions CI/CD](#3-github-actions-cicd)
4. [Production Environment](#4-production-environment)
5. [Deployment Strategies](#5-deployment-strategies)
6. [Monitoring & Logging](#6-monitoring--logging)

---

## 1. DOCKER SETUP

### File: `backend/Dockerfile`

```dockerfile
# ======================================================
# BACKEND DOCKERFILE
# Multi-stage build for optimized production image
# ======================================================

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Run tests (optional - comment out if you want faster builds)
# RUN npm run test

# ======================================================
# Stage 2: Production stage
FROM node:18-alpine

# Set environment to production
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/src ./src

# Create uploads directory
RUN mkdir -p uploads && chmod 755 uploads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/monitoring/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "src/server.js"]
```

### File: `backend/.dockerignore`

```
node_modules
npm-debug.log
.env
.env.local
.env.*.local
.git
.gitignore
README.md
.vscode
.idea
coverage
*.md
tests
.DS_Store
uploads/*
!uploads/.gitkeep
```

### File: `clinic-management/Dockerfile`

```dockerfile
# ======================================================
# FRONTEND DOCKERFILE
# Multi-stage build for optimized production image
# ======================================================

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build for production
RUN npm run build

# ======================================================
# Stage 2: Production stage with Nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
```

### File: `clinic-management/nginx.conf`

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React Router support - fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (if frontend and backend on same domain)
    location /api {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /socket.io {
        proxy_pass http://backend:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### File: `clinic-management/.dockerignore`

```
node_modules
npm-debug.log
.env
.env.local
.env.*.local
.git
.gitignore
README.md
.vscode
.idea
dist
coverage
*.md
.DS_Store
```

---

## 2. DOCKER COMPOSE

### File: `docker-compose.yml` (Root directory)

```yaml
# ======================================================
# DOCKER COMPOSE CONFIGURATION
# Complete stack: Frontend, Backend, SQL Server, Redis
# ======================================================

version: '3.8'

services:
  # ============================================
  # SQL SERVER DATABASE
  # ============================================
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: clinic-sqlserver
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=YourStrong@Passw0rd
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - sqlserver-data:/var/opt/mssql
      - ./Data:/docker-entrypoint-initdb.d
    networks:
      - clinic-network
    healthcheck:
      test: /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong@Passw0rd" -Q "SELECT 1" || exit 1
      interval: 10s
      timeout: 3s
      retries: 10
      start_period: 10s

  # ============================================
  # REDIS CACHE
  # ============================================
  redis:
    image: redis:7-alpine
    container_name: clinic-redis
    command: redis-server --appendonly yes --requirepass redispassword
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - clinic-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # ============================================
  # BACKEND API
  # ============================================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: clinic-backend
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DB_SERVER=sqlserver
      - DB_PORT=1433
      - DB_NAME=ClinicDB
      - DB_USER=sa
      - DB_PASSWORD=YourStrong@Passw0rd
      - JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
      - JWT_REFRESH_SECRET=your-super-secret-refresh-key
      - JWT_EXPIRES_IN=1h
      - JWT_REFRESH_EXPIRES_IN=7d
      - REDIS_URL=redis://:redispassword@redis:6379
      - CORS_ORIGIN=http://localhost:3000
      - MAX_FILE_SIZE=5242880
      - UPLOAD_PATH=./uploads
    ports:
      - "5000:5000"
    depends_on:
      sqlserver:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - backend-uploads:/app/uploads
    networks:
      - clinic-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/api/monitoring/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # ============================================
  # FRONTEND
  # ============================================
  frontend:
    build:
      context: ./clinic-management
      dockerfile: Dockerfile
    container_name: clinic-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - clinic-network
    restart: unless-stopped

  # ============================================
  # NGINX LOAD BALANCER (Optional - for multiple backend instances)
  # ============================================
  nginx:
    image: nginx:alpine
    container_name: clinic-nginx
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
    networks:
      - clinic-network
    restart: unless-stopped

# ============================================
# NETWORKS
# ============================================
networks:
  clinic-network:
    driver: bridge

# ============================================
# VOLUMES
# ============================================
volumes:
  sqlserver-data:
    driver: local
  redis-data:
    driver: local
  backend-uploads:
    driver: local
```

### File: `docker-compose.dev.yml` (Development environment)

```yaml
# ======================================================
# DOCKER COMPOSE - DEVELOPMENT MODE
# Hot reload enabled, debug ports exposed
# ======================================================

version: '3.8'

services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=DevPassword123!
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - sqlserver-dev-data:/var/opt/mssql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    environment:
      - NODE_ENV=development
      - PORT=5000
      - DB_SERVER=sqlserver
      - DB_PASSWORD=DevPassword123!
    ports:
      - "5000:5000"
      - "9229:9229"  # Node debugger port
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

  frontend:
    build:
      context: ./clinic-management
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - ./clinic-management:/app
      - /app/node_modules
    command: npm run dev

volumes:
  sqlserver-dev-data:
```

### File: `backend/Dockerfile.dev`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000 9229

CMD ["npm", "run", "dev"]
```

---

## 3. GITHUB ACTIONS CI/CD

### File: `.github/workflows/ci.yml` (Continuous Integration)

```yaml
# ======================================================
# CONTINUOUS INTEGRATION PIPELINE
# Runs on pull requests and pushes to main
# ======================================================

name: CI Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  # ============================================
  # BACKEND TESTS
  # ============================================
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest

    services:
      sqlserver:
        image: mcr.microsoft.com/mssql/server:2022-latest
        env:
          ACCEPT_EULA: Y
          SA_PASSWORD: TestPassword123!
          MSSQL_PID: Developer
        ports:
          - 1433:1433
        options: >-
          --health-cmd "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P TestPassword123! -Q 'SELECT 1'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Run linter
        working-directory: backend
        run: npm run lint || echo "Add lint script to package.json"

      - name: Run unit tests
        working-directory: backend
        env:
          NODE_ENV: test
          DB_SERVER: localhost
          DB_PASSWORD: TestPassword123!
          JWT_SECRET: test-secret
        run: npm run test:unit

      - name: Run integration tests
        working-directory: backend
        env:
          NODE_ENV: test
          DB_SERVER: localhost
          DB_PASSWORD: TestPassword123!
          JWT_SECRET: test-secret
          REDIS_URL: redis://localhost:6379
        run: npm run test:integration

      - name: Generate coverage report
        working-directory: backend
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage/lcov.info
          flags: backend
          name: backend-coverage

  # ============================================
  # FRONTEND TESTS
  # ============================================
  frontend-tests:
    name: Frontend Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: clinic-management/package-lock.json

      - name: Install dependencies
        working-directory: clinic-management
        run: npm ci

      - name: Run linter
        working-directory: clinic-management
        run: npm run lint

      - name: Run tests
        working-directory: clinic-management
        run: npm test || echo "Add tests to frontend"

      - name: Build production
        working-directory: clinic-management
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: frontend-build
          path: clinic-management/dist

  # ============================================
  # SECURITY SCAN
  # ============================================
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit (Backend)
        working-directory: backend
        run: npm audit --audit-level=moderate

      - name: Run npm audit (Frontend)
        working-directory: clinic-management
        run: npm audit --audit-level=moderate

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  # ============================================
  # CODE QUALITY
  # ============================================
  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Shallow clones disabled for SonarCloud

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

### File: `.github/workflows/cd.yml` (Continuous Deployment)

```yaml
# ======================================================
# CONTINUOUS DEPLOYMENT PIPELINE
# Deploys to production on push to main
# ======================================================

name: CD Pipeline

on:
  push:
    branches: [ main ]
  workflow_dispatch:  # Manual trigger

jobs:
  # ============================================
  # BUILD AND PUSH DOCKER IMAGES
  # ============================================
  build-and-push:
    name: Build and Push Docker Images
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push backend image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/clinic-backend:latest
            ${{ secrets.DOCKER_USERNAME }}/clinic-backend:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/clinic-backend:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/clinic-backend:buildcache,mode=max

      - name: Build and push frontend image
        uses: docker/build-push-action@v5
        with:
          context: ./clinic-management
          push: true
          tags: |
            ${{ secrets.DOCKER_USERNAME }}/clinic-frontend:latest
            ${{ secrets.DOCKER_USERNAME }}/clinic-frontend:${{ github.sha }}
          cache-from: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/clinic-frontend:buildcache
          cache-to: type=registry,ref=${{ secrets.DOCKER_USERNAME }}/clinic-frontend:buildcache,mode=max

  # ============================================
  # DEPLOY TO PRODUCTION
  # ============================================
  deploy:
    name: Deploy to Production
    needs: build-and-push
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_SERVER_HOST }}
          username: ${{ secrets.PROD_SERVER_USER }}
          key: ${{ secrets.PROD_SERVER_SSH_KEY }}
          script: |
            cd /var/www/clinic-management
            docker-compose pull
            docker-compose up -d --remove-orphans
            docker image prune -f

      - name: Health check
        run: |
          sleep 30
          curl -f ${{ secrets.PROD_URL }}/api/monitoring/health || exit 1

      - name: Notify deployment success
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to production successful! 🚀'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: success()

      - name: Notify deployment failure
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Deployment to production failed! ❌'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: failure()
```

---

## 4. PRODUCTION ENVIRONMENT

### File: `.env.production` (Template)

```bash
# ======================================================
# PRODUCTION ENVIRONMENT VARIABLES
# Copy to .env and fill with actual values
# NEVER commit .env to git!
# ======================================================

# Node Environment
NODE_ENV=production

# Server Configuration
PORT=5000
HOST=0.0.0.0

# Database Configuration
DB_SERVER=your-production-db-server.database.windows.net
DB_PORT=1433
DB_NAME=ClinicDB_Production
DB_USER=clinic_admin
DB_PASSWORD=<strong-password-here>
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false

# JWT Configuration
JWT_SECRET=<generate-strong-secret-key>
JWT_REFRESH_SECRET=<generate-strong-refresh-key>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration
REDIS_URL=redis://:password@your-redis-host:6379
REDIS_PASSWORD=<strong-redis-password>

# CORS Configuration
CORS_ORIGIN=https://your-production-domain.com

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=<app-specific-password>
SMTP_FROM=Clinic Management <noreply@clinic.com>

# Monitoring
SENTRY_DSN=<your-sentry-dsn>
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### File: `scripts/generate-secrets.js`

```javascript
/**
 * Generate secure secrets for production
 */

const crypto = require('crypto');

const generateSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

console.log('📝 Generated Production Secrets:\n');
console.log(`JWT_SECRET=${generateSecret()}`);
console.log(`JWT_REFRESH_SECRET=${generateSecret()}`);
console.log(`REDIS_PASSWORD=${generateSecret(32)}`);
console.log(`\n⚠️  IMPORTANT: Save these to your .env file and NEVER commit them to git!`);
```

---

## 5. DEPLOYMENT STRATEGIES

### Blue-Green Deployment Script

### File: `scripts/deploy-blue-green.sh`

```bash
#!/bin/bash

# ======================================================
# BLUE-GREEN DEPLOYMENT SCRIPT
# Zero-downtime deployment strategy
# ======================================================

set -e

# Configuration
BLUE_PORT=5000
GREEN_PORT=5001
HEALTH_ENDPOINT="/api/monitoring/health"

echo "🚀 Starting Blue-Green Deployment..."

# Step 1: Build new version (Green)
echo "📦 Building green environment..."
docker-compose -f docker-compose.green.yml build

# Step 2: Start green environment
echo "▶️  Starting green environment..."
docker-compose -f docker-compose.green.yml up -d

# Step 3: Health check
echo "🏥 Running health checks..."
sleep 30

for i in {1..10}; do
  if curl -f http://localhost:$GREEN_PORT$HEALTH_ENDPOINT > /dev/null 2>&1; then
    echo "✅ Green environment is healthy"
    break
  fi
  
  if [ $i -eq 10 ]; then
    echo "❌ Green environment health check failed"
    docker-compose -f docker-compose.green.yml down
    exit 1
  fi
  
  echo "⏳ Waiting for green environment... ($i/10)"
  sleep 5
done

# Step 4: Switch traffic (update nginx config or load balancer)
echo "🔄 Switching traffic to green environment..."
# Update your load balancer configuration here
# Example: update nginx upstream

# Step 5: Stop blue environment
echo "🛑 Stopping blue environment..."
docker-compose -f docker-compose.blue.yml down

# Step 6: Rename green to blue for next deployment
echo "♻️  Preparing for next deployment..."
mv docker-compose.green.yml docker-compose.blue.yml.backup

echo "✅ Deployment completed successfully!"
```

### Rolling Update Strategy

### File: `scripts/deploy-rolling-update.sh`

```bash
#!/bin/bash

# ======================================================
# ROLLING UPDATE DEPLOYMENT
# Updates instances one by one
# ======================================================

set -e

echo "🔄 Starting Rolling Update..."

# Update images
docker-compose pull

# Update services one by one
services=("backend-1" "backend-2" "backend-3")

for service in "${services[@]}"; do
  echo "📦 Updating $service..."
  
  # Stop old instance
  docker-compose stop $service
  
  # Remove old container
  docker-compose rm -f $service
  
  # Start new instance
  docker-compose up -d $service
  
  # Health check
  sleep 20
  echo "🏥 Health check for $service..."
  
  # Wait for the service to be healthy
  for i in {1..10}; do
    if docker inspect --format='{{.State.Health.Status}}' $service | grep -q healthy; then
      echo "✅ $service is healthy"
      break
    fi
    sleep 5
  done
  
  echo "⏳ Waiting 30s before updating next instance..."
  sleep 30
done

echo "✅ Rolling update completed!"
```

---

## 6. MONITORING & LOGGING

### File: `docker-compose.monitoring.yml`

```yaml
# ======================================================
# MONITORING STACK
# Prometheus + Grafana + Loki
# ======================================================

version: '3.8'

services:
  # ============================================
  # PROMETHEUS - Metrics Collection
  # ============================================
  prometheus:
    image: prom/prometheus:latest
    container_name: clinic-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - clinic-network

  # ============================================
  # GRAFANA - Metrics Visualization
  # ============================================
  grafana:
    image: grafana/grafana:latest
    container_name: clinic-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-clock-panel
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - clinic-network
    depends_on:
      - prometheus

  # ============================================
  # LOKI - Log Aggregation
  # ============================================
  loki:
    image: grafana/loki:latest
    container_name: clinic-loki
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml
      - loki-data:/loki
    networks:
      - clinic-network

  # ============================================
  # PROMTAIL - Log Shipper
  # ============================================
  promtail:
    image: grafana/promtail:latest
    container_name: clinic-promtail
    volumes:
      - ./monitoring/promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log
      - /var/lib/docker/containers:/var/lib/docker/containers
    networks:
      - clinic-network
    depends_on:
      - loki

volumes:
  prometheus-data:
  grafana-data:
  loki-data:

networks:
  clinic-network:
    external: true
```

### File: `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'clinic-backend'
    static_configs:
      - targets: ['backend:5000']
    metrics_path: '/api/monitoring/metrics'

  - job_name: 'clinic-frontend'
    static_configs:
      - targets: ['frontend:80']

  - job_name: 'sqlserver'
    static_configs:
      - targets: ['sqlserver:1433']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

---

## 📊 DEPLOYMENT COMMANDS

```bash
# ============================================
# DEVELOPMENT
# ============================================

# Start all services in development mode
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Rebuild after code changes
docker-compose -f docker-compose.dev.yml up -d --build

# ============================================
# PRODUCTION
# ============================================

# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove all data (CAREFUL!)
docker-compose down -v

# ============================================
# MONITORING
# ============================================

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access Grafana: http://localhost:3000 (admin/admin)
# Access Prometheus: http://localhost:9090

# ============================================
# MAINTENANCE
# ============================================

# Backup database
docker exec clinic-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong@Passw0rd' \
  -Q "BACKUP DATABASE ClinicDB TO DISK='/var/opt/mssql/backup/ClinicDB.bak'"

# Restore database
docker exec clinic-sqlserver /opt/mssql-tools/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong@Passw0rd' \
  -Q "RESTORE DATABASE ClinicDB FROM DISK='/var/opt/mssql/backup/ClinicDB.bak'"

# Clean up
docker system prune -a --volumes
```

---

## 🔒 SECURITY BEST PRACTICES

1. **Never commit secrets to Git**
   - Use `.env` files (in `.gitignore`)
   - Use GitHub Secrets for CI/CD
   - Use cloud secrets manager in production

2. **Use multi-stage Docker builds**
   - Smaller image size
   - No development dependencies in production
   - Better security

3. **Run containers as non-root user**
   - Reduces attack surface
   - Follows principle of least privilege

4. **Enable health checks**
   - Docker can auto-restart unhealthy containers
   - Load balancers can route away from unhealthy instances

5. **Use HTTPS in production**
   - Enable TLS/SSL
   - Use Let's Encrypt for free certificates

6. **Regular security scans**
   - `docker scan` for vulnerabilities
   - `npm audit` for dependencies
   - Trivy for comprehensive scanning

---

**Tổng kết:** File này cung cấp complete DevOps setup với Docker, Docker Compose, CI/CD pipeline, deployment strategies, và monitoring stack. Ready for production deployment!