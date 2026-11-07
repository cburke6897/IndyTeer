import { useState } from 'react'
import { BadgeCheck, CalendarCheck, Clock, Hourglass, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Tabs } from '../../components/ui/Tabs'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { TextArea, TextInput } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { AreaChart } from '../../components/domain/Charts'
import { formatDate, formatHours, todayISO } from '../../lib/utils'
import { useSession } from '../../store/session'
import { hourEntries, hourTotals } from '../../store/selectors'
import { addManualHours, deleteManualHours } from '../../store/actions'
import { act } from '../../store/act'
import type { HourEntry } from '../../types'

export default function MyHoursPage() {
  const { db, volunteer } = useSession()
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')
  const [open, setOpen] = useState(false)
  const [del, setDel] = useState<HourEntry | null>(null)
  const entries = hourEntries(db, volunteer!.id)
  const totals = hourTotals(entries)
  const shown = entries.filter((e) => filter === 'all' || e.status === filter)

  const monthly = (() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const value = entries.filter((e) => e.date.startsWith(key)).reduce((s, e) => s + e.hours, 0)
      return { label: d.toLocaleDateString('en-US', { month: 'short' }), value }
    })
  })()

  return (
    <div>
      <PageHeader
        title="My volunteer hours"
        description="Hours verified by organizations count toward your public profile."
        actions={<Button variant="accent" icon={<Plus size={16} />} onClick={() => setOpen(true)}>Log hours</Button>}
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total hours" value={formatHours(totals.total)} icon={<Clock size={16} />} accent />
        <StatCard label="Verified hours" value={formatHours(totals.verified)} icon={<BadgeCheck size={16} />} hint="Confirmed by organizations" />
        <StatCard label="Pending verification" value={formatHours(totals.pending)} icon={<Hourglass size={16} />} hint="Awaiting review" />
        <StatCard label="Completed events" value={totals.completed} icon={<CalendarCheck size={16} />} />
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0 order-2 xl:order-1">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-2">
            <h3 className="py-3 text-[15px]">Activity history</h3>
            <Tabs className="border-0" value={filter} onChange={setFilter} tabs={[{ id: 'all', label: 'All', count: entries.length }, { id: 'verified', label: 'Verified' }, { id: 'pending', label: 'Pending' }]} />
          </div>
          {shown.length === 0 ? (
            <div className="p-5"><EmptyState icon={<Clock size={20} />} title="No hours here yet" message="Attend an event or log hours from another organization." /></div>
          ) : (
            <div className="overflow-x-auto overflow-y-hidden border-t border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="bg-surface/70 text-xs font-semibold tracking-wide text-muted uppercase">
                    <th className="px-5 py-2.5">Opportunity</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5 text-right">Hours</th><th className="px-3 py-2.5">Status</th><th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((e) => (
                    <tr key={e.id}>
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">{e.title}</p>
                        <p className="text-xs text-muted">{e.orgName}{e.source === 'manual' && ' · Self-reported'}</p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted">{formatDate(e.date)}</td>
                      <td className="px-3 py-3 text-right font-bold text-navy">{formatHours(e.hours)}</td>
                      <td className="px-3 py-3">{e.status === 'verified' ? <Badge tone="success" icon={<BadgeCheck size={12} />}>Verified</Badge> : <Badge tone="gold">Pending</Badge>}</td>
                      <td className="px-3 py-3">
                        {e.source === 'manual' && <button aria-label="Delete entry" onClick={() => setDel(e)} className="rounded p-1.5 text-muted hover:bg-danger-50 hover:text-danger"><Trash2 size={15} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="order-1 xl:order-2">
          <CardHeader title="Hours by month" subtitle="Last 6 months" />
          <div className="p-4"><AreaChart data={monthly} label="Volunteer hours per month" unit=" hrs" /></div>
        </Card>
      </div>

      <LogHoursModal open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        destructive
        title="Delete this entry?"
        message={<>“{del?.title}” ({del && formatHours(del.hours)} hrs) will be removed from your history.</>}
        confirmLabel="Delete entry"
        onConfirm={() => { if (!del) return; void act(deleteManualHours(del.id), 'Entry deleted.', 'info') }}
      />
    </div>
  )
}

function LogHoursModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const blank = { orgName: '', title: '', date: todayISO(), hours: '', notes: '' }
  const [f, setF] = useState(blank)
  const [err, setErr] = useState<Record<string, string>>({})

  async function submit() {
    const e: Record<string, string> = {}
    if (!f.orgName.trim()) e.orgName = 'Enter the organization.'
    if (!f.title.trim()) e.title = 'Describe what you did.'
    if (!f.date) e.date = 'Pick a date.'
    else if (f.date > todayISO()) e.date = 'Date can’t be in the future.'
    if (!(Number(f.hours) > 0 && Number(f.hours) <= 24)) e.hours = 'Enter hours between 0.5 and 24.'
    setErr(e)
    if (Object.keys(e).length) return
    const saved = await act(addManualHours({ orgName: f.orgName.trim(), title: f.title.trim(), date: f.date, hours: Number(f.hours), notes: f.notes.trim() }).then(() => true), 'Hours logged. They’re pending verification.')
    if (!saved) return
    setF(blank)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log volunteer hours"
      description="Self-reported hours stay pending until an organization verifies them."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit}>Submit for verification</Button></>}
    >
      <div className="space-y-4">
        <TextInput label="Organization" value={f.orgName} onChange={(e) => setF({ ...f, orgName: e.target.value })} error={err.orgName} placeholder="e.g. Habitat for Humanity" />
        <TextInput label="What did you do?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} error={err.title} placeholder="e.g. Home build weekend" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Date" type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} error={err.date} />
          <TextInput label="Hours" type="number" step={0.5} min={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} error={err.hours} />
        </div>
        <TextArea label="Notes" optional rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
    </Modal>
  )
}
