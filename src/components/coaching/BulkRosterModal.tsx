/**
 * BulkRosterModal.tsx
 *
 * Spreadsheet-style table for entering multiple athletes at once.
 * - Tab / Shift-Tab navigate between cells
 * - Enter moves to the next row in the same column
 * - Rows with no first_name are ignored on save
 * - "Add 5 rows" appends blank rows
 * - Saves all filled rows in parallel via createAthlete
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, Loader2, AlertCircle } from 'lucide-react';
import { createAthlete } from '../../services/coaching/coachingService';
import { lbsToKg, ftInToCm } from '../../utils/unitConversion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RowData {
  first_name: string;
  last_name: string;
  grade: string;
  squad: string;
  side: string;
  experience_level: string;
  weight_lbs: string;   // display in lbs, convert on save
  height_ft: string;
  height_in: string;
}

type ColKey = keyof RowData;

interface ColDef {
  key: ColKey;
  label: string;
  width: string;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLS: ColDef[] = [
  { key: 'first_name',        label: 'First',       width: 'w-28',  type: 'text',   placeholder: 'First name' },
  { key: 'last_name',         label: 'Last',        width: 'w-28',  type: 'text',   placeholder: 'Last name'  },
  { key: 'grade',             label: 'Year/Class',  width: 'w-24',  type: 'text',   placeholder: '9th, Fr, …' },
  { key: 'squad',             label: 'Squad',       width: 'w-28',  type: 'text',   placeholder: 'e.g. Varsity' },
  { key: 'side',              label: 'Side',        width: 'w-28',  type: 'select',
    options: [
      { value: '',           label: '—'          },
      { value: 'port',       label: 'Port'       },
      { value: 'starboard',  label: 'Starboard'  },
      { value: 'both',       label: 'Both'       },
      { value: 'coxswain',   label: 'Cox'        },
    ],
  },
  { key: 'experience_level',  label: 'Level',       width: 'w-28',  type: 'select',
    options: [
      { value: '',             label: '—'            },
      { value: 'beginner',     label: 'Beginner'     },
      { value: 'intermediate', label: 'Intermediate' },
      { value: 'experienced',  label: 'Experienced'  },
      { value: 'advanced',     label: 'Advanced'     },
    ],
  },
  { key: 'weight_lbs',        label: 'Wt (lbs)',    width: 'w-20',  type: 'text',   placeholder: '155' },
  { key: 'height_ft',         label: "Ht (ft')",    width: 'w-16',  type: 'text',   placeholder: '5'   },
  { key: 'height_in',         label: 'Ht (in")',    width: 'w-16',  type: 'text',   placeholder: '10'  },
];

const COL_KEYS = COLS.map((c) => c.key);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyRow(): RowData {
  return {
    first_name: '', last_name: '', grade: '', squad: '',
    side: '', experience_level: '', weight_lbs: '', height_ft: '', height_in: '',
  };
}

function makeRows(n: number): RowData[] {
  return Array.from({ length: n }, emptyRow);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  userId: string;
  /** Existing squad names to suggest in the squad column */
  existingSquads?: string[];
  onClose: () => void;
  onSaved: (count: number) => void;
}

export function BulkRosterModal({ teamId, userId, existingSquads = [], onClose, onSaved }: Props) {
  const INITIAL_ROWS = 10;
  const [rows, setRows] = useState<RowData[]>(makeRows(INITIAL_ROWS));
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLSelectElement>>(new Map());

  // Focus cell at (rowIdx, colIdx) after paint
  const focusCell = useCallback((rowIdx: number, colIdx: number) => {
    const key = `${rowIdx}-${COL_KEYS[colIdx]}`;
    requestAnimationFrame(() => {
      inputRefs.current.get(key)?.focus();
    });
  }, []);

  // Initial focus
  useEffect(() => {
    focusCell(0, 0);
  }, [focusCell]);

  function updateCell(rowIdx: number, colKey: ColKey, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [colKey]: value };
      return next;
    });
  }

  function handleKeyDown(
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
  ) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextCol >= 0 && nextCol < COL_KEYS.length) {
        focusCell(rowIdx, nextCol);
      } else if (!e.shiftKey && rowIdx < rows.length - 1) {
        focusCell(rowIdx + 1, 0);
      } else if (e.shiftKey && rowIdx > 0) {
        focusCell(rowIdx - 1, COL_KEYS.length - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIdx < rows.length - 1) {
        focusCell(rowIdx + 1, colIdx);
      } else {
        // Last row — append one more and move down
        setRows((prev) => [...prev, emptyRow()]);
        requestAnimationFrame(() => focusCell(rowIdx + 1, colIdx));
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  function addRows(n = 5) {
    setRows((prev) => [...prev, ...makeRows(n)]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    const filled = rows.filter((r) => r.first_name.trim() !== '');
    if (filled.length === 0) {
      setErrors(['No athletes to save — add at least a first name.']);
      return;
    }
    setErrors([]);
    setIsSaving(true);
    const errs: string[] = [];

    await Promise.allSettled(
      filled.map(async (r, i) => {
        try {
          const weight_kg = r.weight_lbs.trim()
            ? lbsToKg(parseFloat(r.weight_lbs))
            : undefined;
          const height_cm =
            r.height_ft.trim() || r.height_in.trim()
              ? ftInToCm(parseFloat(r.height_ft) || 0, parseFloat(r.height_in) || 0)
              : undefined;

          await createAthlete(
            teamId,
            userId,
            {
              first_name: r.first_name.trim(),
              last_name:  r.last_name.trim(),
              grade: r.grade || undefined,
              experience_level: (r.experience_level || undefined) as
                'beginner' | 'intermediate' | 'experienced' | 'advanced' | undefined,
              side: (r.side || undefined) as
                'port' | 'starboard' | 'coxswain' | 'both' | undefined,
              height_cm: isNaN(height_cm as number) ? undefined : height_cm,
              weight_kg: isNaN(weight_kg as number) ? undefined : weight_kg,
            },
            r.squad.trim() || null,
          );
        } catch (err) {
          errs.push(
            `Row ${i + 1} (${r.first_name} ${r.last_name}): ${
              err instanceof Error ? err.message : 'Save failed'
            }`,
          );
        }
      }),
    );

    setIsSaving(false);

    if (errs.length > 0) {
      setErrors(errs);
    } else {
      onSaved(filled.length);
    }
  }

  // Collect squad suggestions (union of existing + typed so far)
  const squadSuggestions = Array.from(
    new Set([...existingSquads, ...rows.map((r) => r.squad).filter(Boolean)]),
  ).sort();

  const filledCount = rows.filter((r) => r.first_name.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-5xl mt-8 mb-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Bulk Add Athletes</h2>
            <p className="text-sm text-neutral-400 mt-0.5">
              Tab between cells · Enter moves down · rows with no first name are skipped
            </p>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Squad datalist ── */}
        <datalist id="squad-suggestions">
          {squadSuggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        {/* Year/Class datalist */}
        <datalist id="year-class-suggestions">
          {/* Scholastic */}
          <option value="8th" />
          <option value="9th" />
          <option value="10th" />
          <option value="11th" />
          <option value="12th" />
          {/* College */}
          <option value="Freshman" />
          <option value="Sophomore" />
          <option value="Junior" />
          <option value="Senior" />
          <option value="5th Year" />
          {/* Club / Masters */}
          <option value="Novice" />
          <option value="Open" />
          <option value="Masters" />
        </datalist>
        {/* ── Table ── */}
        <div className="overflow-x-auto px-4 pt-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-700/60">
                <th className="w-8 pb-2 text-neutral-600 font-normal text-xs text-center">#</th>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.width} pb-2 px-1 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const filled = row.first_name.trim() !== '';
                return (
                  <tr
                    key={rowIdx}
                    className={`border-b border-neutral-800/40 transition-colors ${
                      filled ? 'bg-indigo-950/10' : ''
                    }`}
                  >
                    {/* Row number */}
                    <td className="py-1 text-center text-xs text-neutral-600 select-none">
                      {rowIdx + 1}
                    </td>

                    {/* Cells */}
                    {COLS.map((col, colIdx) => (
                      <td key={col.key} className="py-1 px-1">
                        {col.type === 'select' ? (
                          <select
                            ref={(el) => {
                              const k = `${rowIdx}-${col.key}`;
                              if (el) inputRefs.current.set(k, el);
                              else inputRefs.current.delete(k);
                            }}                            title={col.label}                            value={row[col.key]}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            className="w-full bg-neutral-800/60 border border-neutral-700/40 rounded-md px-2 py-1 text-neutral-200 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-colors"
                          >
                            {col.options!.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : col.key === 'grade' ? (
                          <input
                            ref={(el) => {
                              const k = `${rowIdx}-${col.key}`;
                              if (el) inputRefs.current.set(k, el);
                              else inputRefs.current.delete(k);
                            }}
                            list="year-class-suggestions"
                            type="text"
                            value={row[col.key]}
                            placeholder={col.placeholder}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            className="w-full bg-neutral-800/60 border border-neutral-700/40 rounded-md px-2 py-1 text-neutral-200 text-xs placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-colors"
                          />
                        ) : col.key === 'squad' ? (
                          <input
                            ref={(el) => {
                              const k = `${rowIdx}-${col.key}`;
                              if (el) inputRefs.current.set(k, el);
                              else inputRefs.current.delete(k);
                            }}
                            list="squad-suggestions"
                            type="text"
                            value={row[col.key]}
                            placeholder={col.placeholder}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            className="w-full bg-neutral-800/60 border border-neutral-700/40 rounded-md px-2 py-1 text-neutral-200 text-xs placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-colors"
                          />
                        ) : (
                          <input
                            ref={(el) => {
                              const k = `${rowIdx}-${col.key}`;
                              if (el) inputRefs.current.set(k, el);
                              else inputRefs.current.delete(k);
                            }}
                            type={
                              col.key === 'weight_lbs' || col.key === 'height_ft' || col.key === 'height_in'
                                ? 'number'
                                : 'text'
                            }
                            min={0}
                            value={row[col.key]}
                            placeholder={col.placeholder}
                            onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                            className="w-full bg-neutral-800/60 border border-neutral-700/40 rounded-md px-2 py-1 text-neutral-200 text-xs placeholder-neutral-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition-colors"
                          />
                        )}
                      </td>
                    ))}

                    {/* Remove row */}
                    <td className="py-1 pl-1">
                      <button
                        onClick={() => removeRow(rowIdx)}
                        tabIndex={-1}
                        title="Remove row"
                        className="p-1 rounded text-neutral-700 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Add rows ── */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-3">
          <button
            onClick={() => addRows(5)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add 5 rows
          </button>
          <button
            onClick={() => addRows(10)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add 10 rows
          </button>
        </div>

        {/* ── Errors ── */}
        {errors.length > 0 && (
          <div className="mx-6 mb-3 bg-red-900/20 border border-red-800/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Some rows failed to save:
            </div>
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-300 pl-6">{e}</p>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800">
          <span className="text-sm text-neutral-500">
            {filledCount > 0
              ? `${filledCount} athlete${filledCount !== 1 ? 's' : ''} ready to save`
              : 'Fill in at least a first name to save'}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || filledCount === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Saving…' : `Save ${filledCount > 0 ? filledCount : ''} athlete${filledCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
