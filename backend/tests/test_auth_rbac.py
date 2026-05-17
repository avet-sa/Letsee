from __future__ import annotations

from app.models import User


def register_user(client, payload, headers=None):
    return client.post("/api/auth/register", json=payload, headers=headers or {})


def login_headers(client, email, password):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    access_token = response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def bootstrap_admin(client, email="admin@example.com", password="SecurePass123!"):
    response = register_user(
        client,
        {
            "email": email,
            "password": password,
            "full_name": "Admin User",
            "color": "#3498db",
        },
    )
    assert response.status_code == 200, response.text
    return response.json(), login_headers(client, email, password)


def create_staff_account(
    client,
    admin_headers,
    *,
    name="Staff User",
    email="staff@example.com",
    password="SecurePass123!",
    is_admin=False,
    color="#e74c3c",
):
    response = register_user(
        client,
        {
            "email": email,
            "password": password,
            "full_name": name,
            "color": color,
            "is_admin": is_admin,
        },
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_first_registration_bootstraps_admin_and_links_staff_record(client, db_session):
    response = register_user(
        client,
        {
            "email": "admin@example.com",
            "password": "SecurePass123!",
            "full_name": "Admin User",
            "color": "#1abc9c",
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["is_admin"] is True

    user = db_session.query(User).filter(User.email == "admin@example.com").first()
    assert user is not None
    assert user.is_admin is True
    assert user.full_name == "Admin User"
    assert user.color == "#1abc9c"


def test_admin_can_create_linked_staff_account_with_custom_color(client, db_session):
    _, admin_headers = bootstrap_admin(client)

    response = register_user(
        client,
        {
            "email": "manager@example.com",
            "password": "SecurePass123!",
            "full_name": "Night Manager",
            "color": "#f39c12",
            "is_admin": True,
        },
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["is_admin"] is True

    user = db_session.query(User).filter(User.email == "manager@example.com").first()
    assert user is not None
    assert user.is_admin is True
    assert user.full_name == "Night Manager"
    assert user.color == "#f39c12"


def test_non_admin_cannot_register_new_users(client):
    _, admin_headers = bootstrap_admin(client)
    create_staff_account(client, admin_headers)
    staff_headers = login_headers(client, "staff@example.com", "SecurePass123!")

    response = register_user(
        client,
        {
            "email": "blocked@example.com",
            "password": "SecurePass123!",
            "full_name": "Blocked User",
        },
        headers=staff_headers,
    )

    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "Only admins can create new user accounts"


def test_staff_cannot_modify_people_schedules_or_backups(client, db_session):
    admin_resp, admin_headers = bootstrap_admin(client)
    admin_id = admin_resp["id"]
    
    create_staff_account(client, admin_headers)
    staff_headers = login_headers(client, "staff@example.com", "SecurePass123!")

    schedule_response = client.put(
        "/api/schedules/2026-05-09",
        json={"shifts": {"A": [admin_id], "M": [], "B": [], "C": []}},
        headers=admin_headers,
    )
    assert schedule_response.status_code == 200, schedule_response.text
    assert schedule_response.json()["edited_by"] == "Admin User"

    # Staff cannot create new users (formerly "people")
    create_user_response = client.post(
        "/api/auth/register",
        json={
            "email": "another@example.com",
            "password": "SecurePass123!",
            "full_name": "Another Staff",
            "color": "#2ecc71"
        },
        headers=staff_headers,
    )
    assert create_user_response.status_code == 403, create_user_response.text

    update_schedule_response = client.put(
        "/api/schedules/2026-05-10",
        json={"shifts": {"A": ["Staff User"], "M": [], "B": [], "C": []}},
        headers=staff_headers,
    )
    assert update_schedule_response.status_code == 403, update_schedule_response.text

    list_backups_response = client.get("/api/backups/list", headers=staff_headers)
    assert list_backups_response.status_code == 403, list_backups_response.text

    create_backup_response = client.post("/api/backups/create", headers=staff_headers)
    assert create_backup_response.status_code == 403, create_backup_response.text


def test_staff_can_create_and_soft_delete_handovers(client):
    _, admin_headers = bootstrap_admin(client)
    create_staff_account(client, admin_headers)
    staff_headers = login_headers(client, "staff@example.com", "SecurePass123!")

    create_response = client.post(
        "/api/handovers",
        json={
            "date": "2026-05-09",
            "category": "info",
            "text": "Guest requested extra pillows",
            "followup": True,
            "promised": False,
            "attachments": [],
            "shift": "A",
        },
        headers=staff_headers,
    )
    assert create_response.status_code == 201, create_response.text
    note_id = create_response.json()["id"]

    list_response = client.get("/api/handovers?date=2026-05-09", headers=staff_headers)
    assert list_response.status_code == 200, list_response.text
    assert len(list_response.json()) == 1

    delete_response = client.delete(f"/api/handovers/{note_id}", headers=staff_headers)
    assert delete_response.status_code == 204, delete_response.text

    list_after_delete = client.get("/api/handovers?date=2026-05-09", headers=staff_headers)
    assert list_after_delete.status_code == 200, list_after_delete.text
    assert list_after_delete.json() == []
