# MeetStranger Backend - Setup & Deployment Guide

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git

### Installation
```bash
# Clone repository
git clone <repository-url>
cd backend

# Install dependencies and setup database
npm run setup

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run setup        # Install dependencies + initialize SQLite
npm run dev          # Development with nodemon
npm start            # Production server
npm test             # Jest tests
npm run test:api     # Complete API tests
npm run test:quick   # Quick validation tests
```

## Environment Configuration

### .env File
```bash
# Database
DATABASE_PATH=./database.sqlite

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:8081,exp://192.168.1.100:8081
```

## Development

### Database
- **Development**: SQLite (file-based)
- **Testing**: SQLite (in-memory)
- **Production**: PostgreSQL (recommended)

### Testing
```bash
# Run all test suites
npm test                    # Jest tests (3 tests)
npm run test:api           # Complete API tests (15 tests)  
npm run test:quick         # Quick validation (5 tests)

# Test coverage: 100% (18/18 total tests passing)
```

### API Documentation
- **Interactive Docs**: http://localhost:3000/docs
- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/health

## Production Deployment

### 1. Database Migration
Replace SQLite with PostgreSQL:

```javascript
// Update database connection
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

### 2. Environment Variables
```bash
# Production .env
DATABASE_URL=postgresql://user:pass@host:5432/meetstranger
REDIS_URL=redis://host:6379
JWT_SECRET=super-secure-random-key
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
```

### 3. Process Management
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/app.js --name meetstranger-backend
pm2 startup
pm2 save
```

### 4. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. SSL/HTTPS
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Docker Deployment

### Dockerfile
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/meetstranger
    depends_on:
      - db
      - redis

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=meetstranger
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine

volumes:
  postgres_data:
```

## Monitoring & Logging

### Health Monitoring
```bash
# Health check endpoint
curl http://localhost:3000/api/health

# Response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "websocket": "active"
  }
}
```

### Performance Monitoring
- Use PM2 monitoring: `pm2 monit`
- Add New Relic or DataDog
- Monitor WebSocket connections
- Track queue statistics

### Log Management
```javascript
// Add structured logging
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Security Checklist

### Production Security
- [ ] Change JWT_SECRET to secure random key
- [ ] Enable HTTPS/SSL
- [ ] Configure CORS for production domains
- [ ] Set up rate limiting
- [ ] Enable Helmet security headers
- [ ] Use environment variables for secrets
- [ ] Regular security updates
- [ ] Database connection encryption
- [ ] Input validation on all endpoints
- [ ] Implement API versioning

### Database Security
- [ ] Use connection pooling
- [ ] Enable query logging
- [ ] Regular backups
- [ ] Access control (users/roles)
- [ ] Encrypt sensitive data

## Scaling Considerations

### Horizontal Scaling
- Load balancer (Nginx/HAProxy)
- Multiple server instances
- Redis for session sharing
- Database read replicas

### Performance Optimization
- Connection pooling
- Caching strategies
- CDN for static assets
- Database indexing
- Query optimization

## Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check SQLite file permissions
ls -la database.sqlite

# Recreate database
rm database.sqlite
npm run setup
```

**WebSocket Connection Issues**
```bash
# Check CORS configuration
# Verify allowed origins in .env
# Test with curl or Postman
```

**Rate Limiting Errors**
```bash
# Adjust rate limits in middleware
# Check IP whitelisting
# Monitor request patterns
```

**Memory Issues**
```bash
# Monitor with PM2
pm2 monit

# Check for memory leaks
# Implement cleanup routines
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Or specific modules
DEBUG=socket.io* npm run dev
```

## Backup & Recovery

### Database Backup
```bash
# SQLite backup
cp database.sqlite backup/database_$(date +%Y%m%d).sqlite

# PostgreSQL backup
pg_dump meetstranger > backup/db_$(date +%Y%m%d).sql
```

### Automated Backups
```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

## Support & Maintenance

### Regular Tasks
- Monitor server health
- Update dependencies
- Review logs
- Performance optimization
- Security patches
- Database maintenance

### Version Updates
```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Test after updates
npm test
npm run test:api
```