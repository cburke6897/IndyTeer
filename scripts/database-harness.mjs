import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = new URL('../', import.meta.url)
export async function createDatabase({ beforeMigration } = {}) {
  const pg = new PGlite()
  await pg.exec(await readFile(new URL('supabase/tests/platform.sql', root), 'utf8'))
  const folder = new URL('supabase/migrations/', root)
  for (const file of (await readdir(folder)).filter((n) => n.endsWith('.sql')).sort()) {
    if (beforeMigration) await beforeMigration(pg, file)
    try {
      await pg.exec(await readFile(new URL(file, folder), 'utf8'))
    } catch (error) {
      await pg.close()
      throw new Error(file + ': ' + error.message, { cause: error })
    }
  }
  return pg
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pg = await createDatabase()
  console.log('All database migrations applied successfully to isolated test Postgres.')
  await pg.close()
}
