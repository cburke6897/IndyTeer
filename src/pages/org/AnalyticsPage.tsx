import { useMemo } from 'react'
import { BadgeCheck, CalendarCheck, Clock, Repeat, Users } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardHeader } from '../../components/ui/Card'
import { AreaChart, BarChart, HBarList, RingChart } from '../../components/domain/Charts'
import { formatHours } from '../../lib/utils'
import { useSession } from '../../store/session'
import { getOpp, isPast, orgOpps, orgRegistrations, orgStats } from '../../store/selectors'

export default function AnalyticsPage() {
  const { db, org } = useSession()
  const stats = orgStats(db, org!.id)
  const regs = orgRegistrations(db, org!.id)

  const { regsByMonth, hoursByMonth, topEvents, byCategory } = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-US', { month: 'short' }) }
    })
    const live = regs.filter((r) => r.status === 'pending' || r.status === 'approved')
    const regsByMonth = months.map((m) => ({ label: m.label, value: live.filter((r) => getOpp(db, r.oppId)?.date.startsWith(m.key)).length }))
    const hoursByMonth = months.map((m) => ({
      label: m.label,
      value: Math.round(regs.filter((r) => r.hoursVerified && getOpp(db, r.oppId)?.date.startsWith(m.key)).reduce((s, r) => s + r.hours, 0)),
    }))
    const topEvents = orgOpps(db, org!.id)
      .filter((o) => o.status === 'published' && isPast(o))
      .map((o) => ({ label: o.title, value: regs.filter((r) => r.oppId === o.id && r.attended).length }))
      .sort((a, b) => b.value - a.value).slice(0, 5)
    const cat = new Map<string, number>()
    live.forEach((r) => { const c = getOpp(db, r.oppId)?.category; if (c) cat.set(c, (cat.get(c) ?? 0) + 1) })
    const byCategory = [...cat.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
    return { regsByMonth, hoursByMonth, topEvents, byCategory }
  }, [db, org, regs])

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Registrations, attendance, and impact across your opportunities." />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total registrations" value={stats.totalRegistrations} icon={<Users size={16} />} accent />
        <StatCard label="Completed events" value={stats.completedEvents} icon={<CalendarCheck size={16} />} />
        <StatCard label="Verified hours" value={formatHours(stats.hours)} icon={<Clock size={16} />} />
        <StatCard label="Attendance rate" value={`${stats.attendanceRate}%`} icon={<BadgeCheck size={16} />} hint="Approved who showed up" />
        <StatCard label="Returning volunteers" value={stats.returning} icon={<Repeat size={16} />} hint={`${stats.returningRate}% of ${stats.uniqueVolunteers} volunteers`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Registrations by month" subtitle="By event date, last 6 months" /><div className="p-4"><BarChart data={regsByMonth} label="Registrations per month" /></div></Card>
        <Card><CardHeader title="Verified volunteer hours" subtitle="By event date, last 6 months" /><div className="p-4"><AreaChart data={hoursByMonth} label="Verified hours per month" unit=" hrs" /></div></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card><CardHeader title="Attendance rate" /><div className="p-5"><RingChart value={stats.attendanceRate} label="Approved volunteers who attended" sub="Across all completed events" /></div></Card>
        <Card><CardHeader title="Volunteer loyalty" /><div className="p-5"><RingChart value={stats.returningRate} label="Returning volunteers" sub={`${stats.returning} of ${stats.uniqueVolunteers} attended more than once`} /></div></Card>
        <Card><CardHeader title="Registrations by cause" /><div className="p-5">{byCategory.length ? <HBarList data={byCategory} color="#244B85" /> : <p className="text-sm text-muted">No data yet.</p>}</div></Card>
      </div>

      <Card>
        <CardHeader title="Best attended events" />
        <div className="p-5">{topEvents.length ? <HBarList data={topEvents} /> : <p className="text-sm text-muted">Completed events will appear here.</p>}</div>
      </Card>
    </div>
  )
}
