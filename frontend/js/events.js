/**
 * Server-Sent Events client for live handover, schedule, and staff updates.
 */

const LetseeEvents = (() => {
  const TOKEN_KEY = 'letsee_access_token';
  const MAX_BACKOFF_MS = 30000;

  let eventSource = null;
  let watchedDate = null;
  let reconnectTimer = null;
  let backoffMs = 1000;

  function getApiBase() {
    if (typeof window.API_BASE === 'string') {
      return window.API_BASE;
    }
    const { protocol, hostname, port } = window.location;
    if (port === '3000') {
      return `${protocol}//${hostname}:8000/api`;
    }
    return '/api';
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function dateKeyFromDate(date) {
    if (!date) {
      return null;
    }
    if (typeof window.toLocalDateKey === 'function') {
      return window.toLocalDateKey(date);
    }
    return date.toISOString().split('T')[0];
  }

  function buildStreamUrl(date) {
    const token = getToken();
    if (!token) {
      return null;
    }
    const params = new URLSearchParams({ token });
    if (date) {
      params.set('date', date);
    }
    return `${getApiBase()}/events/stream?${params.toString()}`;
  }

  async function handleEvent(event) {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const type = payload.type || '';
    const eventDate = payload.date || null;
    const currentDateKey =
      typeof currentDate !== 'undefined' && currentDate ? dateKeyFromDate(currentDate) : null;

    const inSearchMode =
      typeof window.searchQuery === 'string' && window.searchQuery.trim().length > 0;
    const dateMatches =
      !eventDate || !currentDateKey || eventDate === currentDateKey || inSearchMode;

    if (type.startsWith('handover.') && dateMatches) {
      if (typeof invalidateRenderCache === 'function') {
        invalidateRenderCache();
      }
      if (typeof renderHandoverNotes === 'function') {
        await renderHandoverNotes(true);
      }
      return;
    }

    if (type === 'schedule.updated' && dateMatches) {
      if (typeof invalidateRenderCache === 'function') {
        invalidateRenderCache();
      }
      if (typeof updatePeopleBlock === 'function') {
        await updatePeopleBlock();
      }
      if (typeof renderHandoverNotes === 'function') {
        await renderHandoverNotes(true);
      }
      if (typeof window.refreshScheduleView === 'function') {
        await window.refreshScheduleView();
      }
      return;
    }

    if (type === 'users.changed' || type === 'people.changed') {
      if (typeof window._refreshPeopleCache === 'function') {
        await window._refreshPeopleCache();
      }
      if (typeof refreshPeopleViews === 'function') {
        await refreshPeopleViews();
      }
    }
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect(watchedDate);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }, backoffMs);
  }

  function connect(date) {
    disconnect();
    const url = buildStreamUrl(date);
    if (!url) {
      console.warn('LetseeEvents: no auth token, skipping SSE connect');
      return;
    }

    watchedDate = date || null;
    backoffMs = 1000;

    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.info('LetseeEvents: connected', watchedDate || 'all dates');
      backoffMs = 1000;
    };

    eventSource.onmessage = (event) => {
      handleEvent(event).catch((err) => {
        console.warn('Realtime event handler failed:', err);
      });
    };

    eventSource.onerror = () => {
      console.warn('LetseeEvents: connection error, reconnecting…');
      disconnect(false);
      scheduleReconnect();
    };
  }

  function disconnect(clearReconnect = true) {
    if (clearReconnect && reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function reconnectForDate(date) {
    const dateKey = dateKeyFromDate(date);
    if (dateKey === watchedDate && eventSource) {
      return;
    }
    connect(dateKey);
  }

  return { connect, disconnect, reconnectForDate };
})();

window.LetseeEvents = LetseeEvents;
