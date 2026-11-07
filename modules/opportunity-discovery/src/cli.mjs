import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { config, root } from './config.mjs'
import { Store } from './store.mjs'
import { PoliteHttp } from './http.mjs'
import { collect } from './collector.mjs'

const settings = config(),
  store = new Store(settings.dbPath)
try {
  if (process.argv[2] === 'collect') {
    const result = await collect(settings, store, new PoliteHttp({ contact: settings.contact }))
    console.log(JSON.stringify(result, null, 2))
    if (result.errors.length) process.exitCode = 1
  } else if (process.argv[2] === 'export') {
    const items = store.list().filter((r) => r.status === 'pending')
    const file = resolve(root, 'data/review-queue.json')
    await writeFile(
      file,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          notice: 'External opportunities, not platform registrations. Review before import.',
          items,
        },
        null,
        2,
      ),
    )
    console.log(`Exported ${items.length} pending listings to ${file}`)
  } else throw new Error('Use npm run collect or npm run export.')
} finally {
  store.close()
}
