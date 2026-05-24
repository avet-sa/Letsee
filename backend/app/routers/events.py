"""Server-Sent Events stream for live handover/schedule/staff updates."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.core.realtime import RealtimeEvent, realtime_hub
from app.core.security import get_current_user_from_query_token
from app.models import User

router = APIRouter(prefix="/api/events", tags=["events"])

HEARTBEAT_SECONDS = 25.0


async def _sse_stream(
    request: Request,
    watched_date: str | None,
) -> asyncio.AsyncIterator[str]:
    queue = await realtime_hub.subscribe(watched_date)
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event: RealtimeEvent = await asyncio.wait_for(
                    queue.get(),
                    timeout=HEARTBEAT_SECONDS,
                )
                yield f"data: {event.to_json()}\n\n"
            except asyncio.TimeoutError:
                yield ": ping\n\n"
    finally:
        await realtime_hub.unsubscribe(queue)


@router.get("/stream")
async def stream_events(
    request: Request,
    date: str | None = Query(None, description="Watch events for this date (YYYY-MM-DD)"),
    _user: User = Depends(get_current_user_from_query_token),
):
    """SSE stream filtered by date (plus global staff events)."""
    return StreamingResponse(
        _sse_stream(request, date),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
