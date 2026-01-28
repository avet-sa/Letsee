# Letsee - Staff Shift Management Platform

A modern, cloud-ready staff shift management system with authentication, built with FastAPI, PostgreSQL, and Docker.

**Replaced**: Legacy PocketBase monolith → Cloud-native architecture with proper authentication, database, and containerization.

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Git

### Run Locally (Docker)

```powershell
cd c:\Users\HP\Desktop\Letsee
copy .env.example .env
docker-compose up
```

Then open **http://localhost:3000** in your browser.

### Demo Account
- Email: `demo@example.com`
- Password: `Demo123456!`

Or register a new account on the login page.

---

## Architecture

```
┌─────────────────────────────────────────┐
│         Browser (localhost:3000)        │
├─────────────────────────────────────────┤
│  Frontend (Nginx)                       │
│  ├─ Serves HTML/CSS/JavaScript          │
│  └─ Proxies /api/ → FastAPI backend     │
├─────────────────────────────────────────┤
│  FastAPI Backend (localhost:8000)       │
│  ├─ 26 REST API endpoints               │
│  ├─ JWT authentication                  │
│  ├─ Automatic hourly backups 🔄         │
│  └─ PostgreSQL ORM (SQLAlchemy)         │
├─────────────────────────────────────────┤
│  PostgreSQL Database (internal)         │
│  └─ 6 tables: users, people, schedules, │
│     handovers, settings, audit          │
├─────────────────────────────────────────┤
│  Minio/S3 Storage (internal)            │
│  ├─ File attachments                    │
│  └─ Database backups (hourly)           │
└─────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: Vanilla HTML/CSS/JavaScript (no build step)
- **Server**: Nginx (Alpine Linux, ~50MB)
- **Features**: Login/Registration/Logout, JWT token management, Real-time schedule editing

### Backend
- **Framework**: FastAPI 0.104.1 (Python 3.11)
- **Database ORM**: SQLAlchemy 2.0.23
- **Migrations**: Alembic 1.13.1
- **Authentication**: JWT (python-jose + cryptography)
- **Password Hashing**: bcrypt 4.1.2
- **Server**: Uvicorn ASGI
- **Image Size**: ~250-300MB (optimized multi-stage build)

### Database
- **Engine**: PostgreSQL 15-Alpine
- **Driver**: psycopg[binary] 3.3.1
- **Image Size**: ~80MB

### DevOps
- **Containerization**: Docker & Docker Compose
- **Storage** (optional): Minio S3-compatible

---

## Project Structure

```
Letsee/
├── backend/                    # FastAPI application
│   ├── app/
│   │   ├── main.py            # FastAPI app, routes, middleware
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic v2 schemas
│   │   ├── core/
│   │   │   ├── config.py      # Environment settings
│   │   │   ├── database.py    # SQLAlchemy engine
│   │   │   └── security.py    # JWT tokens, password hashing
│   │   └── routers/           # API endpoints
│   │       ├── auth.py        # Register, login
│   │       ├── people.py      # Staff management
│   │       ├── schedules.py   # Shift schedules
│   │       ├── handovers.py   # Handover notes
│   │       ├── settings.py    # Settings
│   │       └── files.py       # File upload
│   ├── migrations/            # Alembic migrations
│   ├── pyproject.toml         # Dependencies
│   ├── Dockerfile             # Multi-stage optimized build
│   └── alembic.ini
│
├── frontend/
│   ├── index.html             # Main app
│   ├── login.html             # Login/registration
│   ├── style.css              # Styling
│   ├── script.js              # App logic
│   └── api.js                 # REST API client
│
├── docker-compose.yml         # Orchestration
├── Dockerfile.frontend        # Nginx container
├── nginx.conf                 # Reverse proxy config
├── DOCKER_SETUP.md            # Docker documentation
└── README.md                  # This file
```

---

## API Endpoints (26 Total)

### Authentication (3)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (returns JWT token)
- `POST /api/auth/refresh` - Refresh token

### People (5)
- `GET /api/people` - List all staff
- `POST /api/people` - Create staff member
- `GET /api/people/{id}` - Get staff details
- `PUT /api/people/{id}` - Update staff member
- `DELETE /api/people/{id}` - Delete staff member

### Schedules (5)
- `GET /api/schedules` - List all schedules
- `GET /api/schedules?date=YYYY-MM-DD` - Get by date
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/{id}` - Update schedule
- `DELETE /api/schedules/{id}` - Delete schedule

### Handovers (5)
- `GET /api/handovers` - List all handovers
- `GET /api/handovers?date=YYYY-MM-DD` - Get by date
- `POST /api/handovers` - Create handover
- `PUT /api/handovers/{id}` - Update handover
- `DELETE /api/handovers/{id}` - Delete handover

### Backups (4) 🔄 NEW
- `GET /api/backups/list` - List available backups
- `POST /api/backups/create` - Create manual backup
- `POST /api/backups/restore/{filename}` - Restore from backup
- `POST /api/backups/cleanup` - Delete old backups

### Settings (2)
- `GET /api/settings` - Get all settings
- `PUT /api/settings/{key}` - Update setting

### Files (2)
- `POST /api/files/upload` - Upload file
- `DELETE /api/files/{file_id}` - Delete file

### Health (1)
- `GET /api/health` - Health check

---

## Docker Commands

### Quick Start
```powershell
cd c:\Users\HP\Desktop\Letsee
docker-compose up
```

### Build Images
```powershell
docker-compose build
docker-compose build --no-cache    # Force rebuild
```

### View Logs
```powershell
docker-compose logs -f             # All services
docker-compose logs -f web         # Backend only
docker-compose logs -f frontend    # Frontend only
```

### Stop Services
```powershell
docker-compose down                # Stop all
docker-compose down -v             # Stop and remove volumes
```

### Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Application UI |
| Backend API | http://localhost:8000/api | REST API |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Minio Console | http://localhost:9001 | Object storage |

---

## Development

### Run Backend Locally

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -e .

$env:DATABASE_URL="postgresql://letsee_user:letsee_password@localhost:5432/letsee"
$env:SECRET_KEY="dev-secret-key"

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Run Frontend Locally

```powershell
cd c:\Users\HP\Desktop\Letsee
python -m http.server 3000
```

---

## Major Changes (from PocketBase)

| Aspect | PocketBase | New Stack |
|--------|-----------|-----------|
| **Backend** | Monolithic binary | Modular FastAPI + Python |
| **Database** | SQLite (local) | PostgreSQL (cloud-ready) |
| **Auth** | Built-in | JWT tokens + bcrypt |
| **Frontend** | Embedded | Vanilla JS + Nginx |
| **Deployment** | Single binary | Docker containers |
| **Scalability** | Limited | Horizontal scaling ready |
| **Image Size** | ~80MB | Backend ~250MB, Frontend ~50MB |

---

## Data Protection & Backups 🔄

The system **automatically creates hourly database backups** to protect your hotel shift data from unexpected failures.

### Automatic Backups
- **Frequency**: Every hour
- **Retention**: 24 hourly + 7 daily backups
- **Storage**: Minio/S3 (local or cloud)
- **No configuration needed**: Works automatically

### Quick Backup Commands

```bash
# List all backups
curl http://localhost:8000/api/backups/list

# Create manual backup
curl -X POST http://localhost:8000/api/backups/create

# Restore from backup
curl -X POST http://localhost:8000/api/backups/restore/backup_auto_20260129_120000.sql
```

### Documentation
- **Quick Start**: See `BACKUP_QUICKSTART.md`
- **Full Guide**: See `BACKUP_SYSTEM.md`
- **Deployment**: See `DEPLOYMENT_BACKUPS.md`
- **Architecture**: See `BACKUP_ARCHITECTURE.md`

---

## Troubleshooting

### "Cannot GET /" on localhost:3000
- Check frontend running: `docker ps | grep frontend`
- View logs: `docker-compose logs frontend`

### "Connection refused" on API calls
- Check backend running: `docker ps | grep web`
- View logs: `docker-compose logs web`

### Database connection errors
- Ensure PostgreSQL running: `docker ps | grep db`
- Check DATABASE_URL in docker-compose.yml

### Slow startup
- Backend takes 30-60s for migrations on first run
- Subsequent starts are faster

### Backup issues
- Check logs: `docker logs letsee-backend | grep backup`
- See `BACKUP_QUICKSTART.md` for troubleshooting

---

## Next Steps

- [ ] Data migration from PocketBase to PostgreSQL
- [ ] Mobile app (React Native/Flutter)
- [ ] Advanced reporting & analytics
- [ ] SMS notifications
- [ ] Calendar integration (Google Calendar, Outlook)

---

**Last Updated**: January 12, 2026
**Version**: 2.0 (Migrated from PocketBase)
