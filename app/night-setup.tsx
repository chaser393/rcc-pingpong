'use client';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Choice } from './choice';
import { Player, assignTables, assignTablesByPR } from '@/lib/pong';
import { Shuffle } from 'lucide-react';
export default function NightSetup({
  players,
  initialName,
  defaultTables = 2,
  ranks,
  busy,
  onStart,
}: {
  players: Player[];
  initialName: string;
  defaultTables?: 1 | 2;
  ranks: Record<string, number>;
  busy: boolean;
  onStart: (value: {
    name: string;
    members: { id: string; table: number }[];
  }) => void;
}) {
  const [step, setStep] = useState(1),
    [name, setName] = useState(initialName),
    [attendees, setAttendees] = useState<string[]>([]),
    [tables, setTables] = useState(String(defaultTables)),
    [assignments, setAssignments] = useState<Record<string, string>>({});
  const selected = players.filter((p) => attendees.includes(p.id));
  const count = (table: string) =>
    selected.filter((p) => assignments[p.id] === table).length;
  const valid =
    selected.length >= 4 &&
    [1, ...(tables === '2' ? [2] : [])].every((t) => count(String(t)) >= 4) &&
    selected.every((p) =>
      ['1', ...(tables === '2' ? ['2'] : [])].includes(assignments[p.id]),
    );
  function next() {
    const total = selected.length < 8 ? '1' : tables;
    setTables(total);
    setAssignments(
      assignTablesByPR(
        selected.map((p) => p.id),
        Number(total),
        ranks,
      ),
    );
    setStep(2);
  }
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 1) {
          if (selected.length >= 4) next();
        } else if (valid)
          onStart({
            name,
            members: selected.map((p) => ({
              id: p.id,
              table: Number(assignments[p.id]),
            })),
          });
      }}
    >
      <div className="setup-steps">
        <strong aria-current={step === 1 ? 'step' : undefined}>
          1 · Who’s here?
        </strong>
        <strong aria-current={step === 2 ? 'step' : undefined}>
          2 · Assign tables
        </strong>
      </div>
      <label className="field">
        Night name
        <input
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {step === 1 ? (
        <>
          <div className="row">
            <strong>{selected.length} players attending</strong>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                setAttendees(
                  selected.length === players.length
                    ? []
                    : players.map((p) => p.id),
                )
              }
            >
              {selected.length === players.length
                ? 'Clear selection'
                : 'Select all'}
            </button>
          </div>
          <div className="attendance-picker">
            {players.map((p) => (
              <label
                className={
                  'attendance-option ' +
                  (attendees.includes(p.id) ? 'attending' : '')
                }
                key={p.id}
              >
                <Checkbox
                  checked={attendees.includes(p.id)}
                  onCheckedChange={(checked) =>
                    setAttendees((ids) =>
                      checked
                        ? [...ids, p.id]
                        : ids.filter((id) => id !== p.id),
                    )
                  }
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
          {!players.length && <p>Add or unhide players in the roster first.</p>}
          {selected.length > 0 && (
            <div className="selected-attendees" aria-label="Selected attendees">
              {selected.map((p) => (
                <span key={p.id}>{p.name}</span>
              ))}
            </div>
          )}
          <p className="muted">
            Choose at least four players. Hidden players can be unhidden from
            the roster.
          </p>
          <button disabled={busy || selected.length < 4}>
            Next: assign tables
          </button>
        </>
      ) : (
        <>
          <div className="row">
            <strong>{selected.length} players attending</strong>
            <button
              className="secondary"
              type="button"
              onClick={() => setStep(1)}
            >
              Edit attendance
            </button>
          </div>
          <Choice
            label="Tables in play"
            value={tables}
            onChange={(value) => {
              setTables(value);
              setAssignments(
                assignTablesByPR(
                  selected.map((p) => p.id),
                  Number(value),
                  ranks,
                ),
              );
            }}
            options={[
              { value: '1', label: 'One table' },
              ...(selected.length >= 8
                ? [{ value: '2', label: 'Two tables' }]
                : []),
            ]}
          />
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                setAssignments(
                  assignTablesByPR(
                    selected.map((p) => p.id),
                    Number(tables),
                    ranks,
                  ),
                )
              }
            >
              Assign by PR
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                setAssignments(
                  assignTables(
                    selected.map((p) => p.id),
                    Number(tables),
                    true,
                  ),
                )
              }
            >
              <Shuffle size={16} /> Random tables
            </button>
          </div>
          <div className="assignment-summary">
            <span>Table 1 · {count('1')} players</span>
            {tables === '2' && <span>Table 2 · {count('2')} players</span>}
          </div>
          <div className="picker-list">
            {selected.map((p) => (
              <Choice
                key={p.id}
                label={`${p.name} · ${ranks[p.id] ?? 500} PR`}
                value={assignments[p.id] ?? ''}
                onChange={(value) =>
                  setAssignments((a) => ({ ...a, [p.id]: value }))
                }
                options={[
                  { value: '1', label: 'Table 1' },
                  ...(tables === '2' ? [{ value: '2', label: 'Table 2' }] : []),
                ]}
              />
            ))}
          </div>
          <p className="muted">
            By PR: Table 1 gets the higher-ranked half and Table 2 the
            lower-ranked half. You can change any assignment or randomize
            instead. Each table needs at least four players.
          </p>
          <button disabled={busy || !valid}>
            Start night & generate games
          </button>
        </>
      )}
    </form>
  );
}
