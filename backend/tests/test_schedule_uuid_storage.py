from __future__ import annotations

from app.core.security import get_password_hash
from app.models import Schedule, User


def login_headers(client, email: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    access_token = response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


def create_user(
    db_session,
    *,
    email: str,
    full_name: str,
    password: str = "SecurePass123!",
    is_admin: bool = False,
    color: str = "#3498db",
) -> User:
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        full_name=full_name,
        color=color,
        is_active=True,
        is_admin=is_admin,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_schedule_get_migrates_legacy_name_entries_to_user_ids(client, db_session):
    admin = create_user(
        db_session,
        email="admin@example.com",
        full_name="Admin User",
        is_admin=True,
    )
    alice = create_user(
        db_session,
        email="alice@example.com",
        full_name="Alice Example",
        color="#e74c3c",
    )
    bob = create_user(
        db_session,
        email="bob@example.com",
        full_name="Bob Example",
        color="#2ecc71",
    )

    legacy_schedule = Schedule(
        date="2026-05-09",
        shifts={
            "A": ["Alice Example"],
            "M": ["Bob Example"],
            "B": [],
            "C": [],
        },
        edited_by=admin.full_name,
    )
    db_session.add(legacy_schedule)
    db_session.commit()
    db_session.refresh(legacy_schedule)

    headers = login_headers(client, "admin@example.com", "SecurePass123!")
    response = client.get("/api/schedules?date=2026-05-09", headers=headers)

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload[0]["shifts"] == {
        "A": [str(alice.id)],
        "M": [str(bob.id)],
        "B": [],
        "C": [],
    }

    db_session.expire_all()
    stored_schedule = db_session.query(Schedule).filter(Schedule.date == "2026-05-09").first()
    assert stored_schedule is not None
    assert stored_schedule.shifts == {
        "A": [str(alice.id)],
        "M": [str(bob.id)],
        "B": [],
        "C": [],
    }


def test_schedule_endpoints_reject_invalid_calendar_dates(client, db_session):
    create_user(
        db_session,
        email="admin-invalid-date@example.com",
        full_name="Admin Invalid Date",
        is_admin=True,
    )
    headers = login_headers(client, "admin-invalid-date@example.com", "SecurePass123!")

    list_response = client.get("/api/schedules?date=2026-99-99", headers=headers)
    assert list_response.status_code == 400, list_response.text

    upsert_response = client.put(
        "/api/schedules/2026-02-31",
        json={"shifts": {"A": [], "M": [], "B": [], "C": []}},
        headers=headers,
    )
    assert upsert_response.status_code == 400, upsert_response.text


def test_admin_cannot_delete_staff_member_assigned_to_schedule(client, db_session):
    create_user(
        db_session,
        email="admin-delete@example.com",
        full_name="Admin Delete",
        is_admin=True,
    )
    staff = create_user(
        db_session,
        email="scheduled-staff@example.com",
        full_name="Scheduled Staff",
    )
    db_session.add(
        Schedule(
            date="2026-05-10",
            shifts={"A": [str(staff.id)], "M": [], "B": [], "C": []},
            edited_by="Admin Delete",
        )
    )
    db_session.commit()

    headers = login_headers(client, "admin-delete@example.com", "SecurePass123!")
    response = client.delete(f"/api/users/{staff.id}", headers=headers)

    assert response.status_code == 400, response.text
    assert "Cannot delete staff member" in response.json()["detail"]
