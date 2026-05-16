# Letsee Project Status Review

Reviewed on 2026-05-13 and updated after the quick-fix implementation pass.

## Recommended next step

**Move to the remaining account-management and staff metadata work:**

1. Implement password management: staff can change their own password from settings, and admins can reset staff passwords.
2. Add staff positions in the data model, staff modal, and schedule display.
3. Add schedule date-range loading so the frontend can request only the visible month instead of all history.

These are the next highest-value items now that the smaller security, validation, and UX gaps have been addressed.

## Status changes found during review and quick-fix pass

- `1.8` is now `[x]`: frontend logout calls the backend revocation endpoint before clearing local tokens.
- `1.9` changed from `[~]` to `[x]`: the Traefik `rate-limit@file` middleware is defined and wired to the backend router in production compose.
- `1.12` is now `[x]`: schedule date query/path values are validated as real `YYYY-MM-DD` calendar dates.
- `2.13` is now `[x]`: staff deletion is rejected while the staff member is assigned to schedules.
- `4.2` is now `[x]`: the handover header shift/staff block is hidden when no staff are assigned for the day/current shift.
- `4.8` changed from `[~]` to `[x]`: `schedule.html` uses `schedule.js`, and `schedule.js` updates the theme icon when the theme changes.
- `4.9` is now `[x]`: the hotkeys button was replaced with a small `Press ? for shortcuts` hint and the shortcuts modal now matches the other compact modals.
- `4.17` is now `[x]`: Docker Compose services have CPU and memory limits.
- `4.18` is now `[x]`: Docker Compose services have health checks.
- `trigger ? to show short keys only when idle` is now `[x]`: `?` only opens shortcuts when focus is not in an input, textarea, or select.

## Verified checklist

### Stage 1: Critical - Security Vulnerabilities & Data Integrity

- [x] 1.1 Generate strong `SECRET_KEY` and update production env placeholder.
- [x] 1.2 Remove hardcoded production credentials from `docker-compose.prod.yml`.
- [x] 1.3 Add CSP header in Traefik configuration.
- [x] 1.4 Escape/sanitize note fields before rendering.
- [x] 1.5 Fix backup restore path traversal with basename and filename checks.
- [x] 1.6 Add MIME type validation for uploads.
- [x] 1.7 Protect backup endpoints with admin checks.
- [x] 1.8 Implement token blacklist/revocation on logout.
- [x] 1.9 Add persistent Traefik rate limiting and wire it to production backend traffic.
- [x] 1.10 Store schedule assignments as UUIDs instead of names.
- [x] 1.11 Add server-side schedule validation for duplicate assignments and active user IDs.
- [x] 1.12 Add schedule endpoint input validation for duplicate IDs, valid shift keys, UUID existence, and valid dates.

### Stage 2: High - Core Authentication, Authorization & Schema Fixes

- [x] 2.1 Add `is_admin` to the user model.
- [x] 2.2 Support staff/admin login.
- [~] 2.3 Introduce RBAC for staff and admins. Admin-only guards are present for major mutating admin routes, but the policy is not centralized and some legacy/dead code remains.
- [x] 2.4 Remove public signup from the normal UI flow.
- [x] 2.5 Restrict staff management UI/actions to admins and support email/password when creating staff accounts.
- [ ] 2.6 Allow staff to set their own password and admins to reset passwords.
- [x] 2.7 Prevent staff members from editing schedules.
- [ ] 2.8 Allow admins to assign positions to staff in staff management.
- [x] 2.9 Align handover UI with backend `shifts.{A,M,B,C}` schema.
- [x] 2.10 Use direct schedule upsert via `PUT /api/schedules/{date}`.
- [x] 2.11 Add `getCurrentShiftCode(date)` helper.
- [x] 2.12 Add `getAssignedPeopleForShift(daySchedule, shiftCode)` helper.
- [x] 2.13 Handle staff deletion gracefully by rejecting deletion while assigned to schedules.
- [x] 2.14 Merge/link users and people records into the user/staff model.

### Stage 3: Medium - Code Quality, Architecture & Performance

- [ ] 3.1 Remove inline `onclick` handlers from HTML and generated markup.
- [~] 3.2 Add basic module structure. Utility/state files exist, but the app still uses globals and inline handlers.
- [ ] 3.3 Replace global variables with centralized state management.
- [ ] 3.4 Add `data-action` attributes and cleaner event delegation.
- [x] 3.5 Escape note text, guest, room, added-by, and edited-by fields before `innerHTML`.
- [ ] 3.6 Add pagination to list endpoints.
- [ ] 3.7 Add Redis caching for frequently accessed data.
- [x] 3.8 Optimize database pooling for production load.
- [x] 3.9 Add database indexes for common queries.
- [ ] 3.10 Load only current-month schedules instead of all history.
- [x] 3.11 Fix missing DOM listeners in `schedule.js`.

### Stage 4: Low - Features, UX Improvements & DevOps

- [x] 4.1 Tie scheduler to today's staff on the handover page.
- [x] 4.2 Hide the shift grid/staff header if there are no shifts for the day/current shift.
- [ ] 4.3 Import/export schedules as CSV.
- [ ] 4.4 Add copy/cut/paste/clear schedule controls.
- [ ] 4.5 Add settings modal and move theme/staff management there.
- [ ] 4.6 Allow staff to set their own color in settings.
- [ ] 4.7 Add staff positions and show them in schedules.
- [x] 4.8 Toggle the theme icon in `schedule.html`.
- [x] 4.9 Remove the hotkeys button and replace it with a `?` hint.
- [~] 4.10 Add backend unit tests. Current tests cover RBAC and schedule UUID storage; handover/backup/schedule edge coverage remains incomplete.
- [ ] 4.11 Add API integration tests.
- [x] 4.12 Add migration tests for name-to-UUID schedule conversion.
- [ ] 4.13 Add frontend tests.
- [ ] 4.14 Achieve 80%+ code coverage.
- [~] 4.15 Add Grafana dashboards. Loki/Grafana and a logs dashboard exist; error-rate, latency, and disk dashboards are not present.
- [ ] 4.16 Set up alerts for high error rates, DB pool exhaustion, and low disk space.
- [x] 4.17 Add Docker Compose CPU/memory limits.
- [x] 4.18 Enable container health checks for all services.
- [ ] 4.19 Set up automated backup restore testing.
- [ ] 4.20 Add schedule date range query support with `from_date` and `to_date`.

### Additional backlog

- [x] Trigger `?` shortcuts only when idle.
- [~] Decentralize theme in the database. The main handover page uses settings storage, while the schedule page still uses `localStorage`.
- [x] Allow attachment images opened from blob URLs under CSP.
- [x] Support more than one attachment per note.
- [ ] Add a recycle bin for deleted notes in `index.html`.
- [ ] Assign positions to staff members and show them in the schedule and staff modal.

## Evidence notes

- Frontend logout now calls the backend token revocation endpoint and clears local tokens afterward.
- Schedule endpoints now reject invalid date strings for query and path values instead of treating arbitrary strings as dates.
- Staff deletion now checks schedule assignments and returns a clear error before soft-deleting an assigned user.
- The handover header hides the staff/shift block when no one is assigned, and the shortcuts help is available through an idle-only `?` keypress.
- Production Traefik rate limiting is both defined and attached to the backend router.
- Docker Compose now includes health checks and resource limits for the application and production observability services.
- The schedule page still loads all schedules via `DB.getSchedule()` without a month/date-range filter.
- Inline handlers remain in both HTML files and generated note/schedule markup.
