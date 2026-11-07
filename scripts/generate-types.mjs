import { mkdir, writeFile } from 'node:fs/promises'
import { createDatabase } from './database-harness.mjs'
const pg = await createDatabase()
const { rows: enums } = await pg.query(
  "select t.typname, array_agg(e.enumlabel order by e.enumsortorder) labels from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' group by t.typname",
)
const enumNames = new Set(enums.map((e) => e.typname))
function type(name) {
  if (name.startsWith('_')) return '(' + type(name.slice(1)) + ')[]'
  if (enumNames.has(name)) return 'Database["public"]["Enums"][' + JSON.stringify(name) + ']'
  if (['int2', 'int4', 'int8', 'numeric', 'float4', 'float8'].includes(name)) return 'number'
  if (name === 'bool') return 'boolean'
  if (['json', 'jsonb'].includes(name)) return 'Json'
  if (name === 'void') return 'undefined'
  if (name === 'trigger') return 'unknown'
  return 'string'
}
const { rows: columns } = await pg.query(
  "select c.table_name,c.column_name,c.udt_name,c.is_nullable,c.column_default,t.table_type from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name where c.table_schema='public' order by c.table_name,c.ordinal_position",
)
const names = [...new Set(columns.map((c) => c.table_name))]
const groups = Object.fromEntries(names.map((n) => [n, columns.filter((c) => c.table_name === n)]))
const { rows: fks } = await pg.query(
  "select c.conname, c.conrelid::regclass::text as source,c.confrelid::regclass::text as target,array(select a.attname from unnest(c.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num order by k.ord) as columns,array(select a.attname from unnest(c.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num order by k.ord) as refs from pg_constraint c where c.contype='f' and c.connamespace='public'::regnamespace",
)
function fields(cols, mode) {
  return cols
    .map((c) => {
      const optional =
        mode === 'Update' || (mode === 'Insert' && (c.column_default || c.is_nullable === 'YES'))
      return (
        JSON.stringify(c.column_name) +
        (optional ? '?' : '') +
        ': ' +
        type(c.udt_name) +
        (c.is_nullable === 'YES' ? ' | null' : '') +
        ';'
      )
    })
    .join('\n')
}
function relationships(n) {
  const rows = []
  for (const fk of fks.filter((f) => f.source === n)) {
    for (const target of [
      fk.target,
      ...(fk.target === 'users'
        ? ['public_users']
        : fk.target === 'organizations'
          ? ['public_organizations']
          : []),
    ]) {
      rows.push(
        '{ foreignKeyName: ' +
          JSON.stringify(fk.conname) +
          '; columns: ' +
          JSON.stringify(fk.columns) +
          '; isOneToOne: false; referencedRelation: ' +
          JSON.stringify(target) +
          '; referencedColumns: ' +
          JSON.stringify(fk.refs) +
          ' }',
      )
    }
  }
  return '[' + rows.join(',') + ']'
}
let text =
  '// Generated from versioned migrations by npm run db:types. Do not edit by hand.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]\nexport type Database = { __InternalSupabase: { PostgrestVersion: "14.18" }; public: {\nTables: {'
for (const n of names.filter((n) => groups[n][0].table_type === 'BASE TABLE'))
  text +=
    JSON.stringify(n) +
    ': { Row: {' +
    fields(groups[n], 'Row') +
    '}; Insert: {' +
    fields(groups[n], 'Insert') +
    '}; Update: {' +
    fields(groups[n], 'Update') +
    '}; Relationships: ' +
    relationships(n) +
    ' };\n'
text += '}; Views: {'
for (const n of names.filter((n) => groups[n][0].table_type === 'VIEW'))
  text += JSON.stringify(n) + ': { Row: {' + fields(groups[n], 'Row') + '}; Relationships: [] };\n'
text += '}; Enums: {'
for (const e of enums)
  text += JSON.stringify(e.typname) + ': ' + e.labels.map(JSON.stringify).join(' | ') + ';'
text += '}; Functions: {'
const { rows: funcs } = await pg.query(
  "select p.proname,p.proargnames,p.proargmodes,p.pronargdefaults,p.proretset,t.typname retname, array(select typname from unnest(coalesce(p.proallargtypes,p.proargtypes::oid[])) with ordinality x(oid,ord) join pg_type t on t.oid=x.oid order by ord) argtypes from pg_proc p join pg_type t on t.oid=p.prorettype where p.pronamespace='public'::regnamespace order by p.proname",
)
for (const f of funcs) {
  const modes = f.proargmodes || f.argtypes.map(() => 'i')
  const inputs = f.argtypes
    .map((t, i) => ({ type: t, name: f.proargnames?.[i] || 'arg' + i, mode: modes[i] }))
    .filter((a) => a.mode === 'i' || a.mode === 'b')
  const outputs = f.argtypes
    .map((t, i) => ({ type: t, name: f.proargnames?.[i], mode: modes[i] }))
    .filter((a) => a.mode === 't' || a.mode === 'o')
  const args = inputs.length
    ? '{' +
      inputs
        .map(
          (a, i) =>
            JSON.stringify(a.name) +
            (i >= inputs.length - f.pronargdefaults ? '?' : '') +
            ': ' +
            type(a.type),
        )
        .join(';') +
      '}'
    : 'Record<never, never>'
  let ret = groups[f.retname]
    ? 'Database["public"]["Tables"][' + JSON.stringify(f.retname) + ']["Row"]'
    : type(f.retname)
  if (outputs.length)
    ret = '{' + outputs.map((a) => JSON.stringify(a.name) + ': ' + type(a.type)).join(';') + '}'
  if (f.proretset) ret += '[]'
  text += JSON.stringify(f.proname) + ': { Args: ' + args + '; Returns: ' + ret + ' };\n'
}
text += '}; CompositeTypes: Record<never, never> } }\n'
text += 'export type Tables<T extends keyof (Database["public"]["Tables"] & Database["public"]["Views"])> = (Database["public"]["Tables"] & Database["public"]["Views"])[T]["Row"]\n'
await writeFile(new URL('../src/types/database.ts', import.meta.url), text)
await mkdir(new URL('../supabase/functions/_shared/', import.meta.url), { recursive: true })
await writeFile(new URL('../supabase/functions/_shared/database.ts', import.meta.url), text)
await pg.close()
console.log('Database types generated from tested migrations.')
