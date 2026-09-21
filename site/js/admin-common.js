/**
 * Shared helpers for admin managers (files / users / games).
 * Never assume API payloads are well-formed: old or corrupt entities
 * must become a flagged row, not a blank page.
 */
(function (global) {
  const API_BASE = 'https://vkp-consulting.fr/apiv2/internal';
  const LOGIN_URL = '/login.html';
  const HUB_URL = '/aval/';
  const LOGOUT_URL =
    'https://vkp-auth.auth.eu-north-1.amazoncognito.com/logout?client_id=77e2cmbthjul60ui7guh514u50&logout_uri=https://vkp-consulting.fr/logout.html';
  let authHandled = false;

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function decodeJWT(token) {
    try {
      const base64Url = String(token).split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const parsed = JSON.parse(jsonPayload);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asString(value, fallback = '') {
    if (value == null) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return fallback;
  }

  function asBool(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  function asNumber(value, fallback = null) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  }

  function formatBytes(value) {
    const n = asNumber(value);
    if (n == null) return '—';
    if (n < 1024) return `${n} B`;
    return `${Math.round(n / 102.4) / 10} KB`;
  }

  function prettyJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function parseJsonText(text) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (error) {
      return { ok: false, error: error.message || 'Invalid JSON' };
    }
  }

  function itemId(value) {
    if (typeof value === 'string' || typeof value === 'number') return asString(value);
    const obj = asObject(value);
    return asString(obj.id || obj.name || obj.key);
  }

  function collection(payload, keys) {
    if (Array.isArray(payload)) return payload;
    const obj = asObject(payload);
    const names = Array.isArray(keys) ? keys : [keys || 'items'];
    for (let i = 0; i < names.length; i += 1) {
      if (Array.isArray(obj[names[i]])) return obj[names[i]];
    }
    return [];
  }

  function listNames(payload) {
    if (typeof payload === 'string') return payload ? [payload] : [];
    if (Array.isArray(payload)) return payload.map(itemId).filter(Boolean);
    const obj = asObject(payload);
    const list = collection(obj, ['names', 'items', 'files', 'ids']);
    if (list.length) return list.map(itemId).filter(Boolean);
    if (typeof obj.names === 'string' && obj.names) return [obj.names];
    return [];
  }

  function pathId(id) {
    return encodeURIComponent(asString(id));
  }

  function nextCursorOf(payload) {
    return asString(asObject(payload).nextCursor, '') || undefined;
  }

  function setPager(spec) {
    const pageIndex = spec && spec.pageIndex ? spec.pageIndex : 0;
    const prev = document.getElementById((spec && spec.prevId) || 'prev-page');
    const next = document.getElementById((spec && spec.nextId) || 'next-page');
    const label = document.getElementById((spec && spec.labelId) || 'page-label');
    if (prev) prev.disabled = pageIndex === 0;
    if (next) next.disabled = !(spec && spec.nextCursor);
    if (label) label.textContent = 'Page ' + (pageIndex + 1);
  }

  function showEmptyDetail(panel, text) {
    if (!panel) return;
    panel.replaceChildren();
    const el = document.createElement('div');
    el.className = 'empty-detail';
    el.textContent = text || 'Select an item in the list.';
    panel.appendChild(el);
  }

  async function readResponse(res) {
    const text = await res.text();
    if (!text) {
      return { json: null, text: '', parsed: true };
    }
    try {
      return { json: JSON.parse(text), text, parsed: true };
    } catch {
      return { json: null, text, parsed: false };
    }
  }

  function errorMessage(json, text, status) {
    const obj = asObject(json);
    return asString(obj.detail || obj.title || obj.message, text || `HTTP ${status}`);
  }

  async function request(method, path, body, extraHeaders) {
    const idToken = getCookie('idToken');
    const headers = { Accept: 'application/json', ...(extraHeaders || {}) };
    if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    if (idToken) headers.Authorization = `Bearer ${idToken}`;

    let serialized;
    if (!(body === undefined || body === null || method === 'GET' || method === 'HEAD')) {
      try {
        serialized = JSON.stringify(body);
      } catch (error) {
        return { ok: false, status: 0, error: 'Could not serialize request body: ' + (error.message || error), data: null, rawText: '' };
      }
    }

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: serialized
      });
    } catch (error) {
      return { ok: false, status: 0, error: error.message || 'Network error', data: null, rawText: '' };
    }

    if (res.status === 204 || res.status === 304) {
      return { ok: true, status: res.status, data: null, etag: res.headers.get('ETag'), rawText: '' };
    }

    const parsed = await readResponse(res);

    if (res.status === 401) {
      if (!authHandled) {
        authHandled = true;
        if (confirm('Authentication required. Redirect to login?')) {
          window.location.href = loginUrlWithNext();
        }
      }
      return { ok: false, status: 401, error: 'Authentication required', data: parsed.json, rawText: parsed.text };
    }
    if (res.status === 403) {
      if (!authHandled) {
        authHandled = true;
        alert('Access denied. Admin role required.');
        window.location.href = HUB_URL;
      }
      return { ok: false, status: 403, error: 'Access denied', data: parsed.json, rawText: parsed.text };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: errorMessage(parsed.json, parsed.text, res.status),
        data: parsed.json,
        rawText: parsed.text,
        parseError: !parsed.parsed
      };
    }
    if (!parsed.parsed) {
      return {
        ok: false,
        status: res.status,
        error: 'Response was not JSON',
        data: null,
        rawText: parsed.text,
        parseError: true,
        etag: res.headers.get('ETag')
      };
    }
    return {
      ok: true,
      status: res.status,
      data: parsed.json,
      rawText: parsed.text,
      etag: res.headers.get('ETag'),
      parseError: false
    };
  }

  async function mapPool(items, concurrency, fn) {
    const list = asArray(items);
    const out = new Array(list.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(concurrency || 6, Math.max(list.length, 1)) }, async () => {
      while (next < list.length) {
        const index = next++;
        try {
          out[index] = await fn(list[index], index);
        } catch (error) {
          out[index] = { unreadable: true, error: error.message || String(error), id: asString(list[index]) };
        }
      }
    });
    if (list.length === 0) return [];
    await Promise.all(workers);
    return out;
  }

  function badge(text, kind) {
    const span = document.createElement('span');
    span.className = `badge badge-${kind || 'guest'}`;
    span.textContent = asString(text, '—');
    return span;
  }

  function mountTable(container, spec) {
    if (!container) return;
    container.replaceChildren();
    const rows = asArray(spec.rows);
    if (rows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'alert alert-info';
      empty.textContent = spec.empty || 'No items.';
      container.appendChild(empty);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    asArray(spec.columns).forEach((col) => {
      const th = document.createElement('th');
      th.textContent = asString(col.title);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row, index) => {
      const tr = document.createElement('tr');
      const key = spec.getKey ? spec.getKey(row, index) : asString(row && row.id, String(index));
      if (spec.selectedKey && key === spec.selectedKey) tr.classList.add('selected');
      if (row && row.unreadable) tr.classList.add('row-bad');
      try {
        asArray(spec.columns).forEach((col) => {
          const td = document.createElement('td');
          let cell;
          try {
            cell = col.render ? col.render(row, index) : row[col.key];
          } catch (error) {
            cell = `? (${error.message || 'render error'})`;
            tr.classList.add('row-bad');
          }
          if (cell instanceof Node) td.appendChild(cell);
          else td.textContent = cell == null || cell === '' ? '—' : String(cell);
          tr.appendChild(td);
        });
      } catch (error) {
        tr.replaceChildren();
        const td = document.createElement('td');
        td.colSpan = Math.max(asArray(spec.columns).length, 1);
        td.textContent = `Could not render ${key}: ${error.message || error}`;
        tr.appendChild(td);
        tr.classList.add('row-bad');
      }
      if (spec.onSelect) {
        tr.addEventListener('click', () => spec.onSelect(row, key));
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  function showAlert(message, type) {
    const container = document.getElementById('alert-container');
    if (!container) {
      window.alert(message);
      return;
    }
    const alert = document.createElement('div');
    alert.className = `alert alert-${type || 'info'}`;
    alert.textContent = asString(message);
    container.appendChild(alert);
    setTimeout(() => alert.remove(), 6000);
  }

  function bindTabs(onSwitch) {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab, onSwitch));
    });
  }

  function switchTab(tabName, onSwitch) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-content').forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-content') === tabName);
    });
    if (typeof onSwitch === 'function') onSwitch(tabName);
  }

  function loginUrlWithNext() {
    try {
      return LOGIN_URL + '?next=' + encodeURIComponent(window.location.pathname + window.location.search);
    } catch {
      return LOGIN_URL;
    }
  }

  function initAuth(options) {
    const optional = Boolean(options && options.optional);
    const idToken = getCookie('idToken');
    if (!idToken) {
      if (!optional) window.location.href = loginUrlWithNext();
      return null;
    }
    const payload = decodeJWT(idToken) || {};
    const displayName = asString(
      payload.display_name || payload['custom:display_name'] || payload.email,
      'User'
    );
    const role = asString(
      payload.role || payload['custom:role'] || asArray(payload['cognito:groups'])[0],
      'user'
    );
    const nameEl = document.getElementById('user-display-name');
    const roleEl = document.getElementById('user-role');
    const bar = document.getElementById('user-info-bar');
    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = role;
    if (bar) bar.style.display = 'flex';
    return { displayName, role, payload };
  }

  function logout() {
    document.cookie = 'idToken=; Max-Age=0; path=/';
    document.cookie = 'accessToken=; Max-Age=0; path=/';
    document.cookie = 'refreshToken=; Max-Age=0; path=/';
    window.location.href = LOGOUT_URL;
  }

  function setLoading(container, label) {
    if (!container) return;
    container.innerHTML = `<div class="loading"><div class="spinner"></div><p>${escapeHtml(label || 'Loading...')}</p></div>`;
  }

  function normalizeMove(raw) {
    const obj = asObject(raw);
    const ctx = asObject(obj.context);
    return {
      userId: asString(obj.userId),
      moveType: asString(ctx.moveType || obj.moveType || obj.value, '—'),
      size: asNumber(ctx.size != null ? ctx.size : obj.size, 0),
      decorId: asNumber(ctx.decorId != null ? ctx.decorId : obj.decorId, 0)
    };
  }

  function normalizeRound(raw, index) {
    const obj = asObject(raw);
    let moves = asArray(obj.moves).map(normalizeMove);
    if (moves.length === 0) {
      asArray(obj.subRounds).forEach((sub) => {
        moves = moves.concat(asArray(asObject(sub).moves).map(normalizeMove));
      });
    }
    const status = asString(obj.status);
    const isFinished = asBool(obj.isFinished) || status === 'finished';
    return {
      id: asString(obj.id, String(index + 1)),
      status: status || (isFinished ? 'finished' : 'pending'),
      isFinished,
      moves
    };
  }

  function normalizeGame(id, raw) {
    const warnings = [];
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        id: asString(id),
        unreadable: true,
        error: 'Game payload is not an object',
        usersIds: [],
        rounds: [],
        isFinished: false,
        status: 'unknown',
        raw
      };
    }
    if (!Array.isArray(raw.usersIds) && raw.usersIds != null) warnings.push('usersIds was not an array');
    if (!Array.isArray(raw.rounds) && raw.rounds != null) warnings.push('rounds was not an array');
    const usersIds = asArray(raw.usersIds).map((uid) => asString(uid)).filter(Boolean);
    const rounds = asArray(raw.rounds).map(normalizeRound);
    const status = asString(raw.status);
    const isFinished = asBool(raw.isFinished) || status === 'finished';
    const metadata = asObject(raw.metadata);
    return {
      id: asString(raw.id, id),
      usersIds,
      rounds,
      isFinished,
      status: status || (isFinished ? 'finished' : 'created'),
      lastModified: metadata.lastModified || raw.lastModified,
      etag: asString(raw.etag || metadata.etag),
      unreadable: false,
      warnings,
      raw
    };
  }

  function normalizeCognitoUser(raw) {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return { unreadable: true, error: 'User payload is not an object', username: '?', raw };
    }
    const profile = raw.gameProfile && typeof raw.gameProfile === 'object' && !Array.isArray(raw.gameProfile)
      ? {
          id: asString(raw.gameProfile.id),
          name: asString(raw.gameProfile.name, '—'),
          externalId: asNumber(raw.gameProfile.externalId)
        }
      : null;
    return {
      username: asString(raw.username || raw.email, '?'),
      sub: asString(raw.sub),
      email: asString(raw.email || raw.username),
      displayName: asString(raw.displayName, asString(raw.email || raw.username, '—')),
      group: asString(raw.group, ''),
      enabled: asBool(raw.enabled),
      status: asString(raw.status, 'UNKNOWN'),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      gameProfile: profile,
      recentAudit: asArray(raw.recentAudit).map((item) => asObject(item)),
      unreadable: false,
      raw
    };
  }

  function normalizeS3User(id, raw) {
    const obj = asObject(raw);
    const name = asString(obj.name);
    const externalId = asNumber(obj.externalId);
    const unreadable = !name || externalId == null;
    return {
      id: asString(obj.id, id),
      name: name || '—',
      externalId,
      unreadable,
      error: unreadable ? 'Missing name or externalId' : '',
      raw
    };
  }

  function filePayload(getBody) {
    if (getBody == null || typeof getBody !== 'object' || Array.isArray(getBody)) {
      return { id: '', data: getBody };
    }
    const obj = getBody;
    if (Object.prototype.hasOwnProperty.call(obj, 'id') && Object.prototype.hasOwnProperty.call(obj, 'data')) {
      return { id: asString(obj.id), data: obj.data };
    }
    return { id: asString(obj.id), data: getBody };
  }

  global.Admin = {
    API_BASE,
    escapeHtml,
    asArray,
    asObject,
    asString,
    asBool,
    asNumber,
    formatDate,
    formatBytes,
    prettyJson,
    parseJsonText,
    listNames,
    collection,
    pathId,
    nextCursorOf,
    setPager,
    showEmptyDetail,
    PAGE_SIZE: 20,
    request,
    mapPool,
    badge,
    mountTable,
    showAlert,
    bindTabs,
    switchTab,
    initAuth,
    logout,
    setLoading,
    normalizeGame,
    normalizeCognitoUser,
    normalizeS3User,
    filePayload
  };
})(window);
