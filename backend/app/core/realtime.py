"""PostgreSQL NOTIFY-based realtime event hub for SSE clients."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine

logger = logging.getLogger(__name__)

CHANNEL = "letsee_events"


@dataclass(frozen=True)
class RealtimeEvent:
    type: str
    date: str | None = None
    id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"type": self.type}
        if self.date is not None:
            payload["date"] = self.date
        if self.id is not None:
            payload["id"] = self.id
        return payload

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, raw: str) -> RealtimeEvent:
        data = json.loads(raw)
        return cls(
            type=data["type"],
            date=data.get("date"),
            id=data.get("id"),
        )

    def matches_subscription(self, watched_date: str | None) -> bool:
        """Global events (no date) always match; dated events match the watched day."""
        if self.date is None:
            return True
        if watched_date is None:
            return True
        return self.date == watched_date


def _connection_url() -> str:
    url = settings.DATABASE_URL
    if "+psycopg" in url:
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    return url


def publish_event(
    event_type: str,
    *,
    date: str | None = None,
    entity_id: str | UUID | None = None,
) -> RealtimeEvent:
    """Notify all workers (committed NOTIFY) and local SSE subscribers."""
    event = RealtimeEvent(
        type=event_type,
        date=date,
        id=str(entity_id) if entity_id is not None else None,
    )
    with engine.connect() as conn:
        conn.execute(
            text("SELECT pg_notify(:channel, :payload)"),
            {"channel": CHANNEL, "payload": event.to_json()},
        )
        conn.commit()
    return event


class RealtimeHub:
    """Fan-out NOTIFY payloads to in-process SSE subscriber queues."""

    def __init__(self) -> None:
        self._subscribers: list[tuple[asyncio.Queue[RealtimeEvent], str | None]] = []
        self._listener_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        if self._listener_task is None:
            self._listener_task = asyncio.create_task(
                self._listen_loop(),
                name="realtime-listener",
            )

    async def stop(self) -> None:
        if self._listener_task is None:
            return
        self._listener_task.cancel()
        try:
            await self._listener_task
        except asyncio.CancelledError:
            pass
        self._listener_task = None

    async def subscribe(self, watched_date: str | None) -> asyncio.Queue[RealtimeEvent]:
        queue: asyncio.Queue[RealtimeEvent] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.append((queue, watched_date))
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[RealtimeEvent]) -> None:
        async with self._lock:
            self._subscribers = [(q, d) for q, d in self._subscribers if q is not queue]

    async def broadcast(self, event: RealtimeEvent) -> None:
        async with self._lock:
            subscribers = list(self._subscribers)
        for queue, watched_date in subscribers:
            if not event.matches_subscription(watched_date):
                continue
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Dropping realtime event for slow SSE subscriber")

    async def _listen_loop(self) -> None:
        import psycopg
        from psycopg import sql

        conninfo = _connection_url()
        while True:
            try:
                async with await psycopg.AsyncConnection.connect(conninfo) as conn:
                    await conn.set_autocommit(True)
                    await conn.execute(sql.SQL("LISTEN {}").format(sql.Identifier(CHANNEL)))
                    logger.info("Realtime listener subscribed to %s", CHANNEL)
                    async for notify in conn.notifies():
                        try:
                            event = RealtimeEvent.from_json(notify.payload)
                        except (json.JSONDecodeError, KeyError, TypeError):
                            logger.warning("Ignoring invalid realtime payload: %s", notify.payload)
                            continue
                        await self.broadcast(event)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Realtime listener disconnected; retrying in 1s")
                await asyncio.sleep(1)


realtime_hub = RealtimeHub()
