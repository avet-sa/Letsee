# Letsee - Hotel Front Office Shift Handover & Management System

Letsee is a modern, high-performance, and secure shift handover and management system designed specifically for hotel front office teams. It streamlines communication between shifts, manages staff schedules, and provides a central repository for important guest-related information and operational notes.

## 🌟 Key Features

-   **Shift Handover Notes:** Create, categorize, and track operational notes (Info, Todo, Important, Guest Request).
-   **Staff Management:** Manage front office team members with customizable color coding for easy identification in schedules.
-   **Dynamic Scheduling:** Plan and view daily shifts (A, M, B, C) with a user-friendly interface.
-   **File Attachments:** Securely upload and associate documents or images with handover notes, powered by S3-compatible storage.
-   **Secure Authentication:** JWT-based user registration and login with robust password hashing.
-   **Operational Dashboard:** Real-time visibility into pending tasks and guest promises.
-   **Integrated Monitoring:** Full observability stack with Loki, Promtail, and Grafana for log aggregation and system health monitoring.
-   **Automated Backups:** Built-in database backup system using `pg_dump` with secure storage in S3/Minio, featuring automated rotation and manual restore capabilities.
-   **Production-Ready:** Containerized with Docker, reverse-proxied by Traefik with automatic HTTPS, and backed by PostgreSQL.

---

## 🏗️ Architecture & Tech Stack

Letsee is built with a modern decoupled architecture:

### **Backend**
-   **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
-   **Database:** [PostgreSQL](https://www.postgresql.org/)
-   **ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/) with [Alembic](https://alembic.sqlalchemy.org/) migrations
-   **Validation:** [Pydantic v2](https://docs.pydantic.dev/)
-   **Security:** JWT (python-jose), Bcrypt (passlib)
-   **Storage:** [Minio](https://min.io/) (S3-compatible)

### **Frontend**
-   **Architecture:** Vanilla JavaScript (ES Modules), Modular CSS, HTML5
-   **API Client:** Custom REST wrapper with local storage token management
-   **Design:** Custom responsive UI designed for desktop and tablet usage in a fast-paced environment.

### **Infrastructure & Observability**
-   **Reverse Proxy:** [Traefik 3.0](https://doc.traefik.io/traefik/)
-   **Logging:** [Grafana Loki](https://grafana.com/oss/loki/) & [Promtail](https://grafana.com/oss/promtail/)
-   **Visualization:** [Grafana](https://grafana.com/oss/grafana/)
-   **Deployment:** Docker & Docker Compose

---

## 🚀 Getting Started (Development)

### **Prerequisites**
-   Python 3.11+
-   Node.js (for linting/formatting)
-   Docker Desktop (optional for local DB/S3)

### **Backend Setup**
1.  Navigate to `backend/`
2.  Create a virtual environment: `python -m venv .venv`
3.  Activate it: `source .venv/bin/activate` (or `.venv\Scripts\activate` on Windows)
4.  Install dependencies: `pip install -e ".[dev]"`
5.  Create a `.env` file based on `.env.prod.example` (or use defaults in `config.py`).
6.  Run migrations: `alembic upgrade head`
7.  Start server: `uvicorn app.main:app --reload`

### **Frontend Setup**
1.  Navigate to `frontend/`
2.  Install dev tools: `npm install`
3.  Start a local server: `npm run dev` (defaults to `http://localhost:3000`)
4.  The frontend is configured to talk to the backend at `http://localhost:8000/api` when running locally.

---

## 🚢 Production Deployment

Letsee is designed to be deployed using Docker Compose.

1.  **Configure Environment:**
    ```bash
    cp .env.prod.example .env.prod
    # Edit .env.prod with your secure credentials and domain
    ```

2.  **SSL Certificates:**
    Place your `cert.pem` and `key.pem` in the `certs/` directory or configure Traefik for Let's Encrypt (see `traefik-config.yml`).

3.  **Launch:**
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

4.  **Access:**
    -   **Frontend:** `https://your-domain.com`
    -   **Backend Docs:** `https://your-domain.com/api/docs` (if DEBUG is enabled)
    -   **Grafana:** `https://your-domain.com/grafana`
    -   **Minio Console:** `https://your-domain.com:9001`

---

## 📊 Monitoring & Logs

The stack includes a pre-configured monitoring pipeline:
-   **Loki:** Aggregates logs from all containers.
-   **Promtail:** Automatically discovers and ships Docker logs.
-   **Grafana:** Provides a dashboard to visualize logs and system status.

To view logs, log in to Grafana and navigate to the "Explore" section selecting the Loki datasource.

---

## 🔒 Security

-   **JWT Authentication:** Stateless authentication with access and refresh tokens.
-   **Rate Limiting:** Global and endpoint-specific rate limiting to prevent brute force.
-   **Security Headers:** Pre-configured Traefik middlewares for HSTS, XSS protection, and Content Security Policy.
-   **Data Integrity:** PostgreSQL WAL archiving enabled for backup and recovery.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
