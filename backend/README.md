# Letsee Backend

FastAPI + PostgreSQL backend for Letsee hotel front office handover application.

## Features

- **JWT Authentication**: Email/password with access and refresh tokens
- **RESTful API**: Full CRUD for people, schedules, handovers, settings
- **File Uploads**: Presigned URLs for S3/Minio integration
- **Database Migrations**: Alembic for schema management
- **Docker Support**: Ready to deploy with docker-compose

## Setup

### Local Development (without Docker)

1. **Install Python 3.11+** and pip

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -e .
   ```

4. **Setup PostgreSQL** locally or via Docker:
   ```bash
   docker run -d --name letsee-db \
     -e POSTGRES_USER=letsee_user \
     -e POSTGRES_PASSWORD=letsee_password \
     -e POSTGRES_DB=letsee \
     -p 5432:5432 \
     postgres:15
   ```

5. **Copy `.env.example` to `.env`** and update DATABASE_URL if needed

6. **Run migrations**:
   ```bash
   alembic upgrade head
   ```

7. **Start server**:
   ```bash
   uvicorn app.main:app --reload
   ```

   API docs: http://localhost:8000/docs

### Docker Compose

1. **Build and start**:
   ```bash
   docker-compose up -d
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f web
   ```

3. **Stop**:
   ```bash
   docker-compose down
   ```

## API Endpoints

### Auth
- `POST /api/auth/register` - Create user account
- `POST /api/auth/login` - Get JWT tokens
- `GET /api/auth/me` - Current user info
- `POST /api/auth/logout` - Logout

### People
- `GET /api/people` - List all people
- `POST /api/people` - Create person
- `GET /api/people/{id}` - Get person
- `PUT /api/people/{id}` - Update person
- `DELETE /api/people/{id}` - Delete person

### Schedules
- `GET /api/schedules?date=YYYY-MM-DD` - List schedules
- `POST /api/schedules` - Create schedule
- `GET /api/schedules/{id}` - Get schedule
- `PUT /api/schedules/{id}` - Update schedule
- `DELETE /api/schedules/{id}` - Delete schedule

### Handovers
- `GET /api/handovers?date=YYYY-MM-DD` - List handover notes
- `POST /api/handovers` - Create note
- `GET /api/handovers/{id}` - Get note
- `PUT /api/handovers/{id}` - Update note
- `DELETE /api/handovers/{id}` - Delete note

### Settings
- `GET /api/settings` - List all settings
- `GET /api/settings/{key}` - Get setting
- `POST /api/settings` - Create setting
- `PUT /api/settings/{key}` - Update setting
- `DELETE /api/settings/{key}` - Delete setting

### Files
- `POST /api/files/presign-upload` - Get presigned upload URL
- `POST /api/files/presign-download/{key}` - Get presigned download URL

## Database Schema

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### People
```sql
CREATE TABLE people (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Schedules
```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY,
  date VARCHAR(10) UNIQUE NOT NULL,
  shift VARCHAR(1) NOT NULL,
  people JSON NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Handovers
```sql
CREATE TABLE handovers (
  id UUID PRIMARY KEY,
  date VARCHAR(10) NOT NULL,
  category VARCHAR(50) NOT NULL,
  room VARCHAR(10),
  guest_name VARCHAR(255),
  text TEXT NOT NULL,
  followup BOOLEAN DEFAULT false,
  promised BOOLEAN DEFAULT false,
  promise_text TEXT,
  attachments JSON DEFAULT '[]',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  completed BOOLEAN DEFAULT false,
  added_by VARCHAR(255),
  shift VARCHAR(1),
  edited_at TIMESTAMP WITH TIME ZONE,
  edited_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### Settings
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

## Environment Variables

See `.env.example` for all available options.

## Testing

```bash
pytest tests/
```

## Deployment

1. **Build image**:
   ```bash
   docker build -t letsee-backend .
   ```

2. **Push to registry** (ECR, Docker Hub, etc.)

3. **Deploy** to Fly.io, Railway, AWS ECS, etc.

## Production Checklist

- [ ] Generate strong `SECRET_KEY`
- [ ] Set `DEBUG=false`
- [ ] Update `CORS_ORIGINS` to your frontend domain
- [ ] Configure S3/Minio for file uploads
- [ ] Setup email/SMTP for user verification
- [ ] Enable HTTPS/TLS
- [ ] Setup database backups
- [ ] Configure logging/monitoring
- [ ] Add rate limiting
- [ ] Setup health check monitoring
