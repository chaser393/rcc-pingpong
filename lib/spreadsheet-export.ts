import { zipSync, strToU8 } from 'fflate';
import {
  stats,
  standings,
  championshipResult,
  latestAttendance,
  adjustment,
  type State,
} from './pong';

type Cell = string | number;
type Row = { cells: Cell[]; heading?: boolean };
export type ExportSheet = { name: string; rows: Row[] };

// Export public fields only, regardless of the downloading user's role.
export function exportSheets(s: State): ExportSheet[] {
  const totals = stats(s);
  const name = (id: string) =>
    s.players.find((p) => p.id === id)?.name ?? 'Unknown player';
  const sheets: ExportSheet[] = [
    {
      name: 'Players',
      rows: [
        {
          cells: [
            'Player',
            'Status',
            'Wins',
            'Losses',
            'Games',
            'PR',
            'Championships',
            'Last night',
            'Last attended (UTC)',
            'Info',
          ],
          heading: true,
        },
        ...s.players
          .filter((p) => !p.deleted)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((p) => {
            const t = totals[p.id],
              last = latestAttendance(s, p.id);
            return {
              cells: [
                p.name,
                p.hidden ? 'Hidden' : 'Active',
                t.wins,
                t.losses,
                t.games,
                t.pr,
                t.championships,
                last?.name ?? '',
                last?.date ?? '',
                p.info,
              ],
            };
          }),
      ],
    },
  ];
  const used = new Set(['players']);
  for (const n of s.nights
    .filter((n) => n.closed)
    .slice()
    .reverse()) {
    const base = (
      n.name
        .replace(/[\\/?:*\[\]\x00-\x1f]/g, ' ')
        .replace(/^'+|'+$/g, '')
        .trim() || 'Night'
    ).slice(0, 31);
    let title = base,
      suffix = 2;
    while (used.has(title.toLowerCase())) {
      const tail = ` (${suffix++})`;
      title = base.slice(0, 31 - tail.length) + tail;
    }
    used.add(title.toLowerCase());
    const result = championshipResult(n);
    const rows: Row[] = [
      { cells: [n.name], heading: true },
      {
        cells: [
          'Date (UTC)',
          n.date,
          'Format',
          n.mode === 'singles' ? 'Singles' : 'Doubles',
        ],
      },
      {
        cells: [
          'Championship',
          n.bestOf === 1 ? 'One game' : 'Best of three',
          'Winner(s)',
          result?.winners.map(name).join(' + ') ?? 'Not decided',
        ],
      },
      { cells: [] },
      {
        cells: [
          'Table',
          'Player',
          'Attendance',
          'Table wins',
          'Table losses',
          'Table games',
          'Starting PR',
          'Night PR change',
          'All night games',
          'Scheduling credit',
        ],
        heading: true,
      },
    ];
    for (const table of [...new Set(n.members.map((p) => p.table))].sort()) {
      for (const p of standings(n, table)) {
        let delta = 0,
          games = 0;
        for (const m of n.matches.filter(
          (m) => m.score && [...m.a, ...m.b].includes(p.id),
        )) {
          const side = m.a.includes(p.id) ? 0 : 1;
          delta +=
            adjustment(m, n).points *
            (m.score![side] > m.score![1 - side] ? 1 : -1);
          games++;
        }
        rows.push({
          cells: [
            table,
            name(p.id),
            p.active ? 'Present at finish' : 'Left',
            p.wins,
            p.losses,
            p.games,
            n.ranks[p.id] ?? 500,
            delta,
            games,
            p.credit,
          ],
        });
      }
    }
    rows.push(
      { cells: [] },
      { cells: ['Match results'], heading: true },
      {
        cells: [
          'Match',
          'Table / Final',
          'Player(s) A',
          'Player(s) B',
          'Score A',
          'Score B',
          'Winner(s)',
          'PR change each',
          'Status',
        ],
        heading: true,
      },
    );
    n.matches.forEach((m, i) =>
      rows.push({
        cells: [
          i + 1,
          m.champ ? 'Championship' : m.table,
          m.a.map(name).join(' + '),
          m.b.map(name).join(' + '),
          m.score?.[0] ?? '',
          m.score?.[1] ?? '',
          m.score
            ? (m.score[0] > m.score[1] ? m.a : m.b).map(name).join(' + ')
            : '',
          m.score ? adjustment(m, n).points : '',
          m.score ? 'Scored' : 'Unplayed',
        ],
      }),
    );
    rows.push(
      { cells: [] },
      {
        cells: [
          'Table standings exclude championship games. Night PR change shows original match results; career totals on Players honor later stat resets.',
        ],
      },
    );
    sheets.push({ name: title, rows });
  }
  return sheets;
}
const xml = (value: string) =>
  value
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// Small, read-only XLSX report: inline strings are literal text, never formulas.
export function exportWorkbook(s: State): Uint8Array {
  const sheets = exportSheets(s),
    files: Record<string, Uint8Array> = {};
  const put = (path: string, body: string) => {
    files[path] = strToU8(declaration + body);
  };
  put(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  );
  put(
    '_rels/.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
  put(
    'xl/workbook.xml',
    `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
  );
  put(
    'xl/_rels/workbook.xml.rels',
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  put(
    'xl/styles.xml',
    `<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF15584D"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  );
  sheets.forEach((sheet, index) => {
    const rows = sheet.rows
      .map(
        (row, r) =>
          `<row r="${r + 1}">${row.cells
            .map((cell, c) => {
              const ref = String.fromCharCode(65 + c) + (r + 1),
                style = row.heading ? ' s="1"' : '';
              return typeof cell === 'number' && Number.isFinite(cell)
                ? `<c r="${ref}"${style}><v>${cell}</v></c>`
                : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(String(cell).slice(0, 32767))}</t></is></c>`;
            })
            .join('')}</row>`,
      )
      .join('');
    put(
      `xl/worksheets/sheet${index + 1}.xml`,
      `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="10" width="22" customWidth="1"/></cols><sheetData>${rows}</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9"/></worksheet>`,
    );
  });
  return zipSync(files);
}
