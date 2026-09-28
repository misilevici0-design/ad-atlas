'use strict';
(() => {
  const PROJECT_URL = 'https://ewdhkrpafmrurkdzxfke.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_kRkp4KjcH6RblsEvmHYksQ_souKOnae';
  const SESSION_KEY = 'ad-atlas-cloud-session-v1';
  let session = null;

  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch {}

  function remember(next) {
    session = next;
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function raw(path, { method = 'GET', body, authenticated = false, headers = {} } = {}) {
    if (authenticated) await refreshIfNeeded();
    const requestHeaders = { apikey: PUBLISHABLE_KEY, ...headers };
    if (body !== undefined && !requestHeaders['Content-Type']) requestHeaders['Content-Type'] = 'application/json';
    if (authenticated && session?.access_token) requestHeaders.Authorization = `Bearer ${session.access_token}`;
    const response = await fetch(PROJECT_URL + path, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : requestHeaders['Content-Type'] === 'application/json' ? JSON.stringify(body) : body
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) throw Error(payload?.msg || payload?.message || payload?.error_description || payload?.error || `Ошибка сервера ${response.status}`);
    return payload;
  }

  async function refreshIfNeeded() {
    if (!session?.refresh_token) return;
    if ((session.expires_at || 0) > Date.now() / 1000 + 60) return;
    const next = await raw('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: session.refresh_token }
    });
    next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600);
    remember(next);
  }

  async function signIn(email, password) {
    const next = await raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600);
    remember(next);
    return currentAccount();
  }

  async function signUp(email, password) {
    const redirect = encodeURIComponent(location.origin + location.pathname);
    const next = await raw(`/auth/v1/signup?redirect_to=${redirect}`, {
      method: 'POST',
      body: { email, password }
    });
    if (next?.access_token) {
      next.expires_at = Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600);
      remember(next);
    }
    return next;
  }

  async function signOut() {
    try { if (session?.access_token) await raw('/auth/v1/logout', { method: 'POST', authenticated: true }); } catch {}
    remember(null);
  }

  async function roleFor(email) {
    const rows = await raw(`/rest/v1/editor_access?select=email,role,enabled&email=eq.${encodeURIComponent(email)}`, { authenticated: true });
    return rows?.find(row => row.enabled) || null;
  }

  async function currentAccount() {
    if (!session?.access_token) return null;
    try {
      const user = await raw('/auth/v1/user', { authenticated: true });
      session.user = user;
      remember(session);
      const access = await roleFor(user.email);
      return { user, role: access?.role || null, canEdit: !!access, isOwner: access?.role === 'owner' };
    } catch (error) {
      if (/token|jwt|session|unauthorized/i.test(error.message)) remember(null);
      throw error;
    }
  }

  async function loadState() {
    const rows = await raw('/rest/v1/map_state?select=data,updated_at&id=eq.main');
    return rows?.[0] || null;
  }

  async function saveState(data) {
    if (!session?.user?.id) await currentAccount();
    const rows = await raw('/rest/v1/map_state?on_conflict=id', {
      method: 'POST', authenticated: true,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: { id: 'main', data, updated_by: session.user.id }
    });
    return rows?.[0] || null;
  }

  async function uploadPhoto(pointId, dataUrl) {
    const blob = await fetch(dataUrl).then(response => response.blob());
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
    const path = `${pointId}/${Date.now()}.${extension}`;
    await raw(`/storage/v1/object/map-photos/${path}`, {
      method: 'POST', authenticated: true, body: blob,
      headers: { 'Content-Type': blob.type || 'image/webp', 'x-upsert': 'true' }
    });
    return `${PROJECT_URL}/storage/v1/object/public/map-photos/${path}`;
  }

  async function listEditors() {
    return raw('/rest/v1/editor_access?select=email,role,enabled,created_at&order=role.desc,created_at.asc', { authenticated: true });
  }

  async function addEditor(email) {
    return raw('/rest/v1/editor_access?on_conflict=email', {
      method: 'POST', authenticated: true,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: { email: email.trim().toLowerCase(), role: 'editor', enabled: true }
    });
  }

  async function setEditorEnabled(email, enabled) {
    return raw(`/rest/v1/editor_access?email=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH', authenticated: true,
      headers: { Prefer: 'return=representation' }, body: { enabled }
    });
  }

  function isAllowedPhoto(value) {
    return typeof value === 'string' && (
      /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value) ||
      value.startsWith(`${PROJECT_URL}/storage/v1/object/public/map-photos/`)
    );
  }

  window.AD_CLOUD = {
    projectUrl: PROJECT_URL,
    signIn, signUp, signOut, currentAccount, loadState, saveState, uploadPhoto,
    listEditors, addEditor, setEditorEnabled, isAllowedPhoto
  };
})();
