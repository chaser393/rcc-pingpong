'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function TablePanel({
  nightId,
  table,
  children,
}: {
  nightId: string;
  table: number;
  children: ReactNode;
}) {
  const key = `pong:hidden-table:${nightId}:${table}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === 'true');
    } catch {}
  }, [key]);
  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {}
  }
  const id = `table-content-${nightId}-${table}`;
  return (
    <section className="table-panel">
      <div className="table-heading">
        <div>
          <span className="eyebrow">ROTATING DOUBLES</span>
          <h3>Table {String(table).padStart(2, '0')}</h3>
        </div>
        <button
          type="button"
          className="table-visibility"
          onClick={toggle}
          aria-expanded={!hidden}
          aria-controls={id}
          aria-label={`${hidden ? 'Show' : 'Hide'} Table ${table}`}
          title="Only changes your view"
        >
          {hidden ? <Eye size={20} /> : <EyeOff size={20} />}{' '}
          {hidden ? 'Show' : 'Hide'}
        </button>
      </div>
      <div id={id} hidden={hidden}>
        {children}
      </div>
    </section>
  );
}
