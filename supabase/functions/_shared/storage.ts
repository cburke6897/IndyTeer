import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import type { Database } from './database.ts'
type ServerClient = ReturnType<typeof createClient<Database>>

// Inventory every page before removal: deleting a child folder while paging its
// parent would shift offsets and silently skip later objects/folders.
export async function removeFolderTree(admin: ServerClient, bucket: string, folder: string) {
  const paths: string[] = []
  async function visit(prefix: string) {
    let offset = 0
    while (true) {
      const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100, offset })
      if (error) throw new Error(`Could not list ${bucket}: ${error.message}`)
      if (!data?.length) break
      for (const item of data) {
        const path = `${prefix}/${item.name}`
        if (item.id) paths.push(path)
        else await visit(path)
      }
      offset += data.length
      if (data.length < 100) break
    }
  }
  await visit(folder)
  for (let offset = 0; offset < paths.length; offset += 100) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100))
    if (error) throw new Error(`Could not remove files from ${bucket}: ${error.message}`)
  }
}
