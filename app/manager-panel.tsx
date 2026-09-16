'use client';
import { useEffect, useState } from 'react';

export default function ManagerPanel({
  onChanged,
}: {
  onChanged: () => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<
    { username: string; role: string }[]
  >([]);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(''),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [deleting, setDeleting] = useState('');
  async function load() {
    const r = await fetch('/api/managers', { cache: 'no-store' });
    const d: any = await r.json();
    if (!r.ok) throw Error(d.error);
    setAccounts(d.managers);
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function submit(action: 'create' | 'password' | 'delete') {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch(
        action === 'create' ? '/api/auth' : '/api/managers',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            username:
              action === 'create'
                ? username
                : action === 'delete'
                  ? deleting
                  : target,
            password,
          }),
        },
      );
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setPassword('');
      setUsername('');
      setTarget('');
      setDeleting('');
      await onChanged();
      if (action === 'password' && target === 'admin') return;
      await load();
      setMessage(
        action === 'delete'
          ? 'Manager removed.'
          : action === 'create'
            ? 'Manager created.'
            : 'Password changed. That manager must sign in again.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="manager-panel">
      <p>The admin account is the super admin. Other accounts are managers.</p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="success">
          {message}
        </p>
      )}
      <ul className="manager-list">
        {accounts.map((a) => (
          <li key={a.username}>
            <div>
              <strong>{a.username}</strong>
              <span className="muted"> · {a.role}</span>
            </div>
            <div className="actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setTarget(a.username);
                  setPassword('');
                  setDeleting('');
                }}
              >
                Change password
              </button>
              {a.username !== 'admin' && (
                <button
                  className="secondary danger"
                  disabled={busy}
                  onClick={() => {
                    setDeleting(a.username);
                    setTarget('');
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {deleting && (
        <div className="notice">
          <p>
            Remove manager {deleting}? Their sign-in access will be revoked.
            Players, scores and history stay saved.
          </p>
          <div className="actions">
            <button
              className="danger"
              disabled={busy}
              onClick={() => void submit('delete')}
            >
              Confirm removal
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting('')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(target ? 'password' : 'create');
        }}
      >
        <h3>{target ? `Change password for ${target}` : 'Add manager'}</h3>
        {!target && (
          <label>
            Username
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <label>
          {target ? 'New password' : 'Password'}
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {target === 'admin' && (
          <p>You will need to sign in again after changing your password.</p>
        )}
        <div className="actions">
          <button disabled={busy}>
            {busy ? 'Saving…' : target ? 'Save password' : 'Create manager'}
          </button>
          {target && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setTarget('');
                setPassword('');
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
