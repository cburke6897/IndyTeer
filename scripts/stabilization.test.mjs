import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createDatabase } from './database-harness.mjs'

test('Existing single-name organization users migrate without NULL field failures', async () => {
  const id = randomUUID()
  const pg = await createDatabase({ beforeMigration: async (db,name) => {
    if(name==='20261107165500_domain_schema.sql'){
      await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,JSON.stringify({full_name:'Casey',account_type:'organization'})])
      await db.query('update public.profiles set bio=null where id=$1',[id])
    }
  }})
  try {
    const user=(await pg.query('select full_name,last_name from public.users where id=$1',[id])).rows[0]
    assert.deepEqual(user,{full_name:'Casey',last_name:''})
    assert.equal((await pg.query('select description from public.organizations where id=$1',[id])).rows[0].description,'')
  } finally { await pg.close() }
})

test('Anonymous users can query published opportunities without private membership privileges', async () => {
  const pg=await createDatabase()
  try {
    await pg.exec('begin; set local role anon')
    const rows=(await pg.query('select id from public.opportunities')).rows
    assert.deepEqual(rows,[])
    await assert.rejects(()=>pg.query("select public.create_organization('{}'::jsonb)"),/permission denied/)
    await pg.exec('rollback')
  } finally { await pg.close() }
})
