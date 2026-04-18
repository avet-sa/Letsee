# Letsee - Hotel Front Office Shift Handover & Management System

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)

A modern, production-ready shift handover and staff management system designed specifically for hotel front office teams.

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture--tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
  - [Development Setup](#development-setup)
  - [Production Deployment](#production-deployment)
- [Configuration](#-configuration)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Authentication & Security](#-authentication--security)
- [Monitoring & Observability](#-monitoring--observability)
- [Backup & Recovery](#-backup--recovery)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## Overview

Letsee streamlines communication between hotel front office shifts, manages staff schedules, and provides a central repository for important guest-related information and operational notes. Built with modern technologies and designed for production deployment, Letsee handles everything from shift planning to file attachments, all while maintaining enterprise-grade security and monitoring.

### Why Letsee?

- **Shift Continuity**: Ensure smooth handovers between staff shifts with categorized notes (Info, Todo, Important, Guest Request)
- **Staff Organization**: Manage team members with visual color coding for easy schedule identification
- **Task Tracking**: Follow up on guest promises and pending tasks with due dates and completion tracking
- **File Management**: Securely attach documents and images to handover notes using S3-compatible storage
- **Production Ready**: Enterprise-grade security, monitoring, and automated backups out of the box

---

## 🌟 Key Features

### Core Functionality

- **Shift Handover Notes**
  - Create, edit, and soft-delete handover entries
  - Categorize notes (Info, Todo, Important, Guest Request)
  - Mark tasks as complete with completion tracking
  - Set due dates and times for follow-up items
  - Associate notes with specific room numbers and guest names

- **Staff Management**
  - Add and manage front office team members
  - Customizable color coding for visual identification in schedules
  - Track who created or edited handovers

- **Dynamic Scheduling**
  - Plan daily shifts across four shift types (A, M, B, C)
  - Drag-and-drop interface for assigning staff to shifts
  - View historical and upcoming schedules
  - Track schedule edit history

- **File Attachments**
  - Upload and associate documents/images with handover notes
  - S3-compatible storage (Minio) with secure access
  - Support for multiple file types with MIME type validation
  - Automatic file cleanup when handovers are deleted

### Security & Authentication

- **JWT-Based Authentication**
  - Dual-token system (access + refresh tokens)
  - Automatic token rotation on refresh
  - Token revocation and blacklisting
  - Single session enforcement (logout invalidates all tokens)
  - Per-user session management

- **Rate Limiting**
  - Global API rate limiting to prevent abuse
  - Endpoint-specific rate limits for sensitive operations (auth, registration)
  - IP-based tracking with automatic cleanup
  - Configurable limits via environment variables

- **Security Headers**
  - HSTS (HTTP Strict Transport Security)
  - XSS Protection
  - Content Security Policy
  - Referrer Policy
  - X-Frame-Options

### Operational Features

- **Automated Database Backups**
  - Scheduled backups using pg_dump
  - S3/Minio storage with metadata tracking
  - Automatic backup rotation (configurable retention)
  - Manual backup and restore via API
  - Backup size and timestamp tracking

- **Comprehensive Logging**
  - Structured logging with JSON output support
  - Request/response logging middleware
  - Configurable log levels
  - Integration with Loki for log aggregation

- **Health Monitoring**
  - Database connectivity checks
  - Service health endpoints for orchestration
  - Docker health checks for all services

---

## 🏗️ Architecture & Tech Stack

### Backend

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) 0.109+ (Python 3.11+)
- **Database**: [PostgreSQL](https://www.postgresql.org/) 15 with WAL archiving
- **ORM**: [SQLAlchemy](https://www.sqlalchemy.org/) 2.0 with type hints
- **Migrations**: [Alembic](https://alembic.sqlalchemy.org/) for database version control
- **Validation**: [Pydantic](https://docs.pydantic.dev/) v2 for data validation
- **Authentication**: JWT tokens via python-jose
- **Password Hashing**: Bcrypt via passlib
- **File Storage**: [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) for S3-compatible storage
- **Process Manager**: Gunicorn with Uvicorn workers for production

### Frontend

- **Architecture**: Vanilla JavaScript (ES Modules)
- **Styling**: Modular CSS with responsive design
- **HTTP Client**: Custom API wrapper with token management
- **Local Storage**: Token persistence and user preferences
- **Design**: Custom UI optimized for desktop and tablet use in fast-paced environments

### Infrastructure

- **Reverse Proxy**: [Traefik](https://doc.traefik.io/traefik/) 3.0
  - Automatic HTTPS with Let's Encrypt support
  - Dynamic configuration from Docker labels
  - Security middlewares (headers, rate limiting)
  
- **Object Storage**: [Minio](https://min.io/)
  - S3-compatible API
  - Web console for bucket management
  - Backup storage for database dumps

- **Logging & Monitoring**:
  - [Grafana Loki](https://grafana.com/oss/loki/) for log aggregation
  - [Promtail](https://grafana.com/oss/promtail/) for log shipping
  - [Grafana](https://grafana.com/oss/grafana/) for visualization

- **Deployment**: Docker and Docker Compose
  - Multi-container orchestration
  - Named volumes for data persistence
  - Health checks and restart policies
  - Resource limits and constraints

### Database Schema Overview

```
users
├── id (UUID, PK)
├── email (unique)
├── hashed_password
├── full_name
├── is_active
└── timestamps

people (staff members)
├── id (UUID, PK)
├── name
├── color (hex)
└── timestamps

schedules
├── id (UUID, PK)
├── date (YYYY-MM-DD, unique)
├── shifts (JSON: {A: [], M: [], B: [], C: []})
├── edited_by
└── timestamps

handovers
├── id (UUID, PK)
├── date (indexed)
├── category
├── room
├── guest_name
├── text
├── followup
├── promised
├── promise_text
├── attachments (JSON array)
├── completed
├── due_date
├── due_time
├── shift
├── added_by
├── edited_by
├── deleted_at (soft delete)
└── timestamps

revoked_tokens
├── id (UUID, PK)
├── token
├── token_type (access/refresh/all)
├── user_id (FK)
├── revoked_at
└── expires_at

settings
├── id (UUID, PK)
├── key (unique)
├── value
└── timestamps
```

---

## 📁 Project Structure

```
letsee/
├── backend/                          # FastAPI backend application
│   ├── app/
│   │   ├── core/                     # Core functionality
│   │   │   ├── backup.py            # Database backup/restore logic
│   │   │   ├── config.py            # Application configuration
│   │   │   ├── database.py          # Database connection and session
│   │   │   ├── logging_config.py    # Structured logging setup
│   │   │   ├── rate_limit.py        # Rate limiting implementation
│   │   │   ├── request_logging.py   # Request/response logging middleware
│   │   │   ├── scheduler.py         # Background task scheduler
│   │   │   └── security.py          # JWT and password utilities
│   │   ├── routers/                 # API route handlers
│   │   │   ├── auth.py              # Authentication endpoints
│   │   │   ├── backups.py           # Backup management API
│   │   │   ├── files.py             # File upload/download
│   │   │   ├── handovers.py         # Handover CRUD operations
│   │   │   ├── people.py            # Staff management
│   │   │   ├── schedules.py         # Shift scheduling
│   │   │   └── settings.py          # Application settings
│   │   ├── models.py                # SQLAlchemy models
│   │   ├── schemas.py               # Pydantic schemas
│   │   └── main.py                  # FastAPI app initialization
│   ├── migrations/                   # Alembic database migrations
│   │   └── versions/                # Migration version files
│   ├── alembic.ini                  # Alembic configuration
│   ├── Dockerfile                   # Backend container image
│   ├── pyproject.toml               # Python dependencies and config
│   └── uv.lock                      # Locked dependencies
│
├── frontend/                         # Vanilla JavaScript frontend
│   ├── css/
│   │   ├── base.css                 # Base styles and CSS variables
│   │   ├── components.css           # Reusable component styles
│   │   ├── login.css                # Login page styles
│   │   ├── main.css                 # Main dashboard styles
│   │   └── schedule.css             # Schedule page styles
│   ├── js/
│   │   ├── api.js                   # API client wrapper
│   │   ├── auth.js                  # Authentication utilities
│   │   ├── components.js            # Shared UI components
│   │   ├── login.js                 # Login page logic
│   │   ├── main.js                  # Dashboard logic
│   │   └── schedule.js              # Schedule page logic
│   ├── index.html                   # Main dashboard page
│   ├── login.html                   # Login page
│   ├── schedule.html                # Schedule management page
│   ├── package.json                 # npm dependencies (dev tools)
│   └── eslint.config.js             # ESLint configuration
│
├── grafana-provisioning/             # Grafana auto-configuration
│   ├── dashboards/                  # Pre-configured dashboards
│   │   └── letsee-dashboard.json
│   └── datasources/                 # Loki datasource config
│       └── loki.yml
│
├── certs/                           # SSL/TLS certificates
│   ├── cert.pem                     # SSL certificate
│   └── key.pem                      # Private key
│
├── docker-compose.prod.yml          # Production Docker Compose configuration
├── Dockerfile.frontend              # Frontend nginx container
├── nginx.conf                       # Nginx configuration for frontend
├── traefik-config.yml               # Traefik static configuration
├── loki-config.yaml                 # Loki configuration
├── promtail-config.yaml             # Promtail configuration
├── LICENSE                          # MIT License
└── README.md                        # This file
```

---

## 🔧 Prerequisites

### For Development

- **Python 3.11+** - Backend runtime
- **Node.js 18+** - Frontend dev tools (linting, formatting)
- **PostgreSQL 15+** - Database (can use Docker)
- **Minio or S3** - Object storage (can use Docker)

### For Production Deployment

- **Docker 24+** - Container runtime
- **Docker Compose 2.20+** - Multi-container orchestration
- **Domain name** - For HTTPS with Traefik/Let's Encrypt
- **SSL certificates** - Or configure Let's Encrypt in Traefik

---

## 🚀 Installation

### Development Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/avet-sa/letsee.git
cd letsee
```

#### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -e ".[dev]"

# Create .env file (or use defaults in config.py)
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

#### 3. Frontend Setup

```bash
cd frontend

# Install development dependencies
npm install

# Start local development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

#### 4. Running with Docker (Optional Development)

```bash
# Start PostgreSQL and Minio for local development
docker-compose -f docker-compose.dev.yml up -d db minio
```

---

### Production Deployment

#### 1. Environment Configuration

```bash
# Copy the example environment file
cp .env.prod.example .env.prod

# Edit with secure credentials
nano .env.prod
```

**Required environment variables:**

```bash
# Database
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_secure_db_password
POSTGRES_DB=letsee

# Backend
SECRET_KEY=your_very_long_random_secret_key_at_least_32_chars
DATABASE_URL=postgresql+psycopg://user:password@db:5432/letsee

# Minio/S3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your_secure_minio_password
MINIO_BUCKET=letsee-attachments

# Application
DOMAIN=your-domain.com
GRAFANA_USER=admin
GRAFANA_PASSWORD=your_secure_grafana_password

# Optional
WEB_CONCURRENCY=2  # Number of Gunicorn workers
```

#### 2. SSL/TLS Certificates

**Option A: Existing Certificates**

Place your certificates in the `certs/` directory:

```bash
certs/
├── cert.pem   # SSL certificate
└── key.pem    # Private key
```

**Option B: Let's Encrypt (Recommended)**

Edit `traefik-config.yml` to enable ACME/Let's Encrypt:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

Then update service labels in `docker-compose.prod.yml` to use the resolver.

#### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

#### 4. Initialize the System

```bash
# Create the first user account via API
curl -X POST "https://your-domain.com/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure_password",
    "full_name": "Admin User"
  }'
```

#### 5. Access the Application

- **Frontend**: `https://your-domain.com`
- **Backend API Docs**: `https://your-domain.com/api/docs` (if DEBUG=true)
- **Grafana**: `https://your-domain.com/grafana`
- **Minio Console**: `https://your-domain.com:9001`

---

## ⚙️ Configuration

### Backend Configuration

Configuration is managed via environment variables (see `backend/app/core/config.py`):

```python
# Core Settings
API_TITLE = "Letsee Backend API"
API_VERSION = "1.0.0"
SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG", default="false").lower() == "true"

# Database
DATABASE_URL = env("DATABASE_URL")

# CORS
CORS_ORIGINS = ["https://your-domain.com", "http://localhost:3000"]
CORS_ALLOW_CREDENTIALS = True

# JWT Tokens
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7
ALGORITHM = "HS256"

# Rate Limiting
RATE_LIMIT_PER_MINUTE = 60
AUTH_RATE_LIMIT_PER_MINUTE = 10

# File Storage
MINIO_ENDPOINT = "minio:9000"
MINIO_ACCESS_KEY = env("MINIO_ACCESS_KEY")
MINIO_SECRET_KEY = env("MINIO_SECRET_KEY")
MINIO_BUCKET = env("MINIO_BUCKET", default="letsee-attachments")
MAX_FILE_SIZE_MB = 10

# Backup Schedule
BACKUP_SCHEDULE = "0 2 * * *"  # 2 AM daily (cron format)
BACKUP_RETENTION_DAYS = 7
```

### Frontend Configuration

The frontend automatically detects the API URL based on the environment:

- **Development**: `http://localhost:8000/api`
- **Production**: Same origin + `/api` path

To override, edit `frontend/js/api.js`:

```javascript
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000/api'
  : '/api';
```

---

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login and get tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/logout` | Logout current session |
| POST | `/api/auth/logout/all` | Logout all sessions |

### Handover Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/handovers` | Create handover note |
| GET | `/api/handovers` | List handovers (with filters) |
| GET | `/api/handovers/{id}` | Get specific handover |
| PUT | `/api/handovers/{id}` | Update handover |
| DELETE | `/api/handovers/{id}` | Soft delete handover |
| PATCH | `/api/handovers/{id}/complete` | Mark as complete |

### Staff Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/people` | Add staff member |
| GET | `/api/people` | List all staff |
| PUT | `/api/people/{id}` | Update staff member |
| DELETE | `/api/people/{id}` | Remove staff member |

### Schedule Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedules` | Create/update schedule |
| GET | `/api/schedules` | List schedules (date range) |
| GET | `/api/schedules/{date}` | Get schedule for date |
| PUT | `/api/schedules/{date}` | Update schedule |

### File Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload` | Upload file attachment |
| GET | `/api/files/{filename}` | Download/view file |
| DELETE | `/api/files/{filename}` | Delete file |

### Backup Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/backups/create` | Trigger manual backup |
| GET | `/api/backups/list` | List available backups |
| POST | `/api/backups/restore` | Restore from backup |

### Request/Response Examples

#### Register User

**Request:**
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "full_name": "John Doe"
}
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "user@example.com",
  "full_name": "John Doe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-04-18T10:30:00Z"
}
```

#### Create Handover Note

**Request:**
```bash
POST /api/handovers
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "date": "2024-04-18",
  "category": "Guest Request",
  "room": "305",
  "guest_name": "Jane Smith",
  "text": "Guest requested extra towels for spa session",
  "followup": true,
  "promised": true,
  "promise_text": "Deliver by 2 PM",
  "due_date": "2024-04-18",
  "due_time": "14:00",
  "shift": "M"
}
```

**Response:**
```json
{
  "id": "987fcdeb-51a2-43f1-9876-543210fedcba",
  "date": "2024-04-18",
  "category": "Guest Request",
  "room": "305",
  "guest_name": "Jane Smith",
  "text": "Guest requested extra towels for spa session",
  "followup": true,
  "promised": true,
  "promise_text": "Deliver by 2 PM",
  "completed": false,
  "attachments": [],
  "timestamp": "2024-04-18T10:45:00Z",
  "added_by": "user@example.com",
  "shift": "M",
  "due_date": "2024-04-18",
  "due_time": "14:00"
}
```

For full API documentation, visit `/api/docs` when running with `DEBUG=true`.

---

## 🗄️ Database Schema

### Migrations

Letsee uses Alembic for database version control:

```bash
# Create a new migration
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history

# View current version
alembic current
```

### Key Tables and Indexes

**Performance Optimizations:**

- `handovers.date` - Indexed for fast date-based queries
- `handovers.deleted_at` - Indexed for soft-delete filtering
- `handovers(date, created_at)` - Composite index for sorted listings
- `revoked_tokens.token` - Indexed for fast token validation
- `revoked_tokens(user_id, token_type)` - Composite index for user session management

---

## 🔒 Authentication & Security

### JWT Token Flow

```
1. User Login
   ↓
2. Backend validates credentials
   ↓
3. Generate access token (30 min) + refresh token (7 days)
   ↓
4. Return both tokens to client
   ↓
5. Client stores tokens in localStorage
   ↓
6. Include access token in Authorization header for API calls
   ↓
7. When access token expires:
   - Send refresh token to /api/auth/refresh
   - Receive new access + refresh tokens
   - Old refresh token is revoked (token rotation)
```

### Token Revocation

Letsee implements a comprehensive token blacklist system:

- **Single Session Enforcement**: Login revokes all previous refresh tokens
- **Logout**: Revokes the current access token and all refresh tokens
- **Logout All Sessions**: Revokes all tokens for the user
- **Token Rotation**: Refresh endpoint revokes old refresh token when issuing new one

### Rate Limiting

Two-tier rate limiting system:

**Global Rate Limit:**
- 60 requests per minute per IP (configurable)
- Applied to all endpoints except health checks

**Auth Rate Limit:**
- 10 requests per minute per IP (configurable)
- Applied to sensitive endpoints: `/register`, `/login`

### Security Best Practices

1. **Always use HTTPS in production** - Enforced via Traefik
2. **Rotate JWT secret keys** - Update `SECRET_KEY` periodically
3. **Regular dependency updates** - Monitor for CVEs
4. **Strong passwords** - Minimum 8 characters, bcrypt hashed
5. **Database access** - Never expose PostgreSQL port publicly
6. **Minio access** - Use IAM policies and bucket policies
7. **Backup encryption** - Consider encrypting backup files at rest

---

## 📊 Monitoring & Observability

### Logging Architecture

```
Application Logs
       ↓
  JSON Format
       ↓
    Promtail (scrapes Docker logs)
       ↓
    Loki (aggregation & indexing)
       ↓
    Grafana (visualization & alerts)
```

### Log Levels

- `DEBUG`: Detailed diagnostic information
- `INFO`: General informational messages (default)
- `WARNING`: Warning messages for recoverable issues
- `ERROR`: Error messages for failures

**Configuration:**

```bash
# In .env.prod
LOG_LEVEL=INFO
LOG_FORMAT=json  # or "text" for development
```

### Accessing Logs

**Via Grafana:**

1. Navigate to `https://your-domain.com/grafana`
2. Login with configured credentials
3. Go to "Explore" section
4. Select Loki datasource
5. Query examples:
   ```
   # All backend logs
   {container_name="letsee-backend"}
   
   # Error logs only
   {container_name="letsee-backend"} |= "ERROR"
   
   # Authentication failures
   {container_name="letsee-backend"} |= "login" |= "failed"
   ```

**Via Docker:**

```bash
# View backend logs
docker logs -f letsee-backend

# View all service logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service
docker-compose -f docker-compose.prod.yml logs -f db
```

### Health Checks

**Service Health:**

```bash
# Backend health
curl https://your-domain.com/api/health

# Database connectivity check
curl https://your-domain.com/health
```

**Docker Health Checks:**

All services include health checks in `docker-compose.prod.yml`:

- Backend: HTTP check on `/api/health`
- Database: `pg_isready` check
- Minio: HTTP check on `/minio/health/live`
- Loki: HTTP check on `/ready`
- Grafana: HTTP check on `/api/health`

---

## 💾 Backup & Recovery

### Automated Backups

Letsee includes a built-in backup system that:

- Runs on a configurable schedule (default: 2 AM daily)
- Uses `pg_dump` for PostgreSQL backups
- Stores backups in S3/Minio with metadata
- Automatically rotates old backups
- Supports both automatic and manual backups

**Configuration:**

```bash
# In .env.prod
BACKUP_SCHEDULE="0 2 * * *"  # Cron format
BACKUP_RETENTION_DAYS=7
```

### Manual Backup

**Via API:**

```bash
curl -X POST "https://your-domain.com/api/backups/create" \
  -H "Authorization: Bearer <access_token>"
```

**Via CLI:**

```bash
# Enter backend container
docker exec -it letsee-backend bash

# Run pg_dump manually
pg_dump -h db -U $POSTGRES_USER -d $POSTGRES_DB > backup.sql
```

### Listing Backups

```bash
curl -X GET "https://your-domain.com/api/backups/list" \
  -H "Authorization: Bearer <access_token>"
```

**Response:**
```json
[
  {
    "filename": "backup_auto_20240418_020000.sql",
    "size_mb": 12.34,
    "created_at": "2024-04-18T02:00:00Z"
  },
  {
    "filename": "backup_manual_20240417_150000.sql",
    "size_mb": 11.89,
    "created_at": "2024-04-17T15:00:00Z"
  }
]
```

### Restoring from Backup

**Via API:**

```bash
curl -X POST "https://your-domain.com/api/backups/restore" \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"filename": "backup_auto_20240418_020000.sql"}'
```

**Via CLI:**

```bash
# Download backup from Minio
docker exec -it letsee-backend bash
python -c "
from app.core.backup import backup_manager
response = backup_manager.s3_client.get_object(
    Bucket='letsee-backups',
    Key='backup_auto_20240418_020000.sql'
)
with open('/tmp/backup.sql', 'wb') as f:
    f.write(response['Body'].read())
"

# Restore to database
psql -h db -U $POSTGRES_USER -d $POSTGRES_DB < /tmp/backup.sql
```

### Backup Storage Location

Backups are stored in the `letsee-backups` Minio bucket, accessible via:

- Minio Console: `https://your-domain.com:9001`
- S3 API: `s3://letsee-backups/`

---

## 🛠️ Development

### Code Style and Linting

**Backend (Python):**

```bash
cd backend

# Run Ruff linter
ruff check app/

# Auto-fix issues
ruff check --fix app/

# Type checking with mypy
mypy app/

# Run all checks
ruff check app/ && mypy app/
```

**Frontend (JavaScript):**

```bash
cd frontend

# Run ESLint
npm run lint

# Auto-fix issues
npm run lint:fix

# Format with Prettier
npm run format

# Check formatting
npm run format:check

# Run all checks
npm run check
```

### Running Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_auth.py

# Run with verbose output
pytest -v
```

### Adding New Dependencies

**Backend:**

```bash
# Add to pyproject.toml dependencies array
# Then reinstall
pip install -e ".[dev]"

# Lock dependencies (if using uv)
uv lock
```

**Frontend:**

```bash
# Add dev dependency
npm install --save-dev <package>

# Update lockfile
npm install
```

### Database Migrations

**Creating a Migration:**

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "Add new column to handovers"

# Create empty migration for data changes
alembic revision -m "Populate default values"
```

**Editing Migrations:**

Migrations are in `backend/migrations/versions/`. Example:

```python
def upgrade() -> None:
    op.add_column('handovers', sa.Column('priority', sa.String(20), nullable=True))
    op.create_index('idx_handover_priority', 'handovers', ['priority'])

def downgrade() -> None:
    op.drop_index('idx_handover_priority', 'handovers')
    op.drop_column('handovers', 'priority')
```

### Adding New API Endpoints

1. **Define Pydantic Schema** (`backend/app/schemas.py`):
```python
class NewFeatureCreate(BaseModel):
    field1: str
    field2: int
```

2. **Create SQLAlchemy Model** (`backend/app/models.py`):
```python
class NewFeature(Base):
    __tablename__ = "new_features"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field1 = Column(String(255), nullable=False)
    field2 = Column(Integer, nullable=False)
```

3. **Create Migration**:
```bash
alembic revision --autogenerate -m "Add new_features table"
alembic upgrade head
```

4. **Add Router** (`backend/app/routers/new_feature.py`):
```python
from fastapi import APIRouter, Depends
from app.core.security import get_current_user

router = APIRouter(prefix="/api/features", tags=["features"])

@router.post("/", response_model=NewFeatureResponse)
async def create_feature(
    data: NewFeatureCreate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Implementation
    pass
```

5. **Register Router** (`backend/app/main.py`):
```python
from app.routers import new_feature
app.include_router(new_feature.router)
```

---

## 🐛 Troubleshooting

### Common Issues

**1. Database Connection Failed**

```bash
# Check if database is running
docker ps | grep letsee-db

# View database logs
docker logs letsee-db

# Test connection manually
docker exec -it letsee-db psql -U $POSTGRES_USER -d $POSTGRES_DB
```

**2. Backend Won't Start**

```bash
# Check backend logs
docker logs letsee-backend

# Common issues:
# - Missing DATABASE_URL in .env.prod
# - Database not ready (wait for health check)
# - Migrations not applied (check logs for alembic errors)

# Fix: Re-run migrations
docker exec -it letsee-backend alembic upgrade head
```

**3. File Upload Errors**

```bash
# Check Minio is running
docker ps | grep letsee-minio

# Verify bucket exists
docker exec -it letsee-backend python -c "
from app.core.backup import backup_manager
buckets = backup_manager.s3_client.list_buckets()
print([b['Name'] for b in buckets['Buckets']])
"

# Check Minio logs
docker logs letsee-minio
```

**4. 502 Bad Gateway**

```bash
# Check Traefik routing
docker logs letsee-traefik

# Verify backend is healthy
curl http://localhost:8000/api/health

# Check service labels
docker inspect letsee-backend | grep -A 20 Labels
```

**5. Token Authentication Errors**

```bash
# Check if token is expired
# JWT tokens can be decoded at https://jwt.io

# Verify SECRET_KEY is consistent
docker exec letsee-backend env | grep SECRET_KEY

# Clear revoked tokens table if needed (dev only!)
docker exec -it letsee-db psql -U $POSTGRES_USER -d $POSTGRES_DB
DELETE FROM revoked_tokens;
```

### Performance Tuning

**Database Connection Pool:**

```bash
# In .env.prod
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
```

**Gunicorn Workers:**

```bash
# Formula: (2 x CPU cores) + 1
WEB_CONCURRENCY=5  # For 2-core server
```

**Rate Limits:**

```bash
RATE_LIMIT_PER_MINUTE=120  # Increase for high traffic
AUTH_RATE_LIMIT_PER_MINUTE=20
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Run tests and linters**:
   ```bash
   cd backend && pytest && ruff check app/
   cd frontend && npm run check
   ```
5. **Commit with clear messages**: `git commit -m "Add amazing feature"`
6. **Push to your fork**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Standards

- **Python**: Follow PEP 8, use type hints, maximum line length 100
- **JavaScript**: Follow ESLint rules, use ES6+ features
- **Commit Messages**: Use conventional commits format
  - `feat:` New feature
  - `fix:` Bug fix
  - `docs:` Documentation changes
  - `refactor:` Code refactoring
  - `test:` Test additions/changes

### Adding Features

Before adding major features:

1. Open an issue to discuss the feature
2. Get feedback from maintainers
3. Follow the architecture patterns in the codebase
4. Add tests for new functionality
5. Update documentation

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Letsee Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [SQLAlchemy](https://www.sqlalchemy.org/) - SQL toolkit and ORM
- [PostgreSQL](https://www.postgresql.org/) - Advanced open source database
- [Traefik](https://traefik.io/) - Modern HTTP reverse proxy
- [Minio](https://min.io/) - High-performance object storage
- [Grafana Stack](https://grafana.com/) - Observability platform

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/avet-sa/letsee/issues)
- **Discussions**: [GitHub Discussions](https://github.com/avet-sa/letsee/discussions)
- **Email**: [Create an issue for support requests]

---

**Built with ❤️ for hotel operations teams**
