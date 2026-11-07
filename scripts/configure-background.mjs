import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const ref = process.argv.find((arg) => arg.startsWith('--project-ref='))?.split('=')[1]
if (!/^[a-z]{20}$/.test(ref ?? '') || !process.argv.includes('--apply')) {
  throw new Error('Use --project-ref=<reviewed project reference> --apply to configure hosted scheduling')
}
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== ref) {
  throw new Error('The linked database differs from the requested project; link the reviewed target first')
}
const run = (args) => execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['supabase', ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
})
mkdirSync('work', { recursive: true })
const envPath = 'supabase/.env.worker.local'
let secret
try { secret = readFileSync(envPath, 'utf8').match(/^CRON_SECRET=([a-f0-9]{64})$/m)?.[1] } catch { /* first setup */ }
secret ??= randomBytes(32).toString('hex')
writeFileSync(envPath, `CRON_SECRET=${secret}\n`)
const url = `https://${ref}.supabase.co`
const sql = `
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
declare existing uuid;
begin
 select id into existing from vault.secrets where name='indyteer_cron_secret';
 if existing is null then perform vault.create_secret('${secret}','indyteer_cron_secret');
 else perform vault.update_secret(existing,'${secret}'); end if;
 select id into existing from vault.secrets where name='indyteer_project_url';
 if existing is null then perform vault.create_secret('${url}','indyteer_project_url');
 else perform vault.update_secret(existing,'${url}'); end if;
end $$;
select cron.schedule('indyteer-background-v1','*/15 * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='indyteer_project_url') || '/functions/v1/background-worker',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='indyteer_cron_secret')),
  body := '{}'::jsonb, timeout_milliseconds := 120000);
$job$);
select jobname, schedule, active from cron.job where jobname='indyteer-background-v1';
`
writeFileSync('work/configure-background.sql', sql)
try {
  run(['secrets', 'set', `--remote=${ref}`, '--env-file', envPath, '--yes'])
  console.log(run(['db', 'query', '--remote', '--file', 'work/configure-background.sql', '--yes']))
  const response = await fetch(`${url}/functions/v1/background-worker`, {
    method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(120000),
  })
  console.log('Worker check:', response.status, await response.text())
  if (!response.ok) process.exitCode = 1
} catch (error) {
  console.error(String(error.message).replaceAll(secret, '[redacted]'))
  process.exitCode = 1
}
