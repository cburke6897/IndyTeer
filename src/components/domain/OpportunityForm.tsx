import { useState } from 'react'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ChipSelect } from '../ui/ChipSelect'
import { ImageUpload } from '../ui/ImageUpload'
import { SafeImage } from '../ui/Avatar'
import { SelectInput, TextArea, TextInput } from '../ui/Field'
import { CATEGORIES, CATEGORY_IMAGE, INDIANA_CITIES, SKILLS } from '../../lib/constants'
import { addDays, formatDate, formatHours, formatTime, todayISO } from '../../lib/utils'
import type { Opportunity, Recurrence } from '../../types'
import type { OpportunityInput } from '../../store/actions'

type Values = {
  title: string; description: string; category: string; image: string | null; date: string; startTime: string; endTime: string
  virtual: boolean; location: string; address: string; city: string; spots: string; minAge: string; skills: string[]
  hours: string; deadline: string; recurrence: Recurrence; instructions: string
}

function toValues(o?: Opportunity): Values {
  return {
    title: o?.title ?? '', description: o?.description ?? '', category: o?.category ?? '', image: o?.image ?? null,
    date: o?.date ?? addDays(todayISO(), 14), startTime: o?.startTime ?? '09:00', endTime: o?.endTime ?? '12:00',
    virtual: o?.virtual ?? false, location: o?.location ?? '', address: o?.address ?? '', city: o?.city ?? 'Indianapolis',
    spots: o ? String(o.spots) : '20', minAge: o?.minAge ? String(o.minAge) : '', skills: o?.skills ?? [],
    hours: o ? String(o.hours) : '3', deadline: o?.deadline ?? addDays(todayISO(), 13), recurrence: o?.recurrence ?? 'none',
    instructions: o?.instructions ?? '',
  }
}

function durationHours(start: string, end: string) {
  const [a, b] = [start, end].map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m })
  return b > a ? (b - a) / 60 : 0
}

export function OpportunityForm({ initial, onSubmit, onCancel }: {
  initial?: Opportunity
  onSubmit: (values: OpportunityInput) => void
  onCancel: () => void
}) {
  const editing = !!initial
  const [v, setV] = useState<Values>(() => toValues(initial))
  const [hoursTouched, setHoursTouched] = useState(editing)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }))

  function setTime(k: 'startTime' | 'endTime', val: string) {
    setV((p) => {
      const next = { ...p, [k]: val }
      const d = durationHours(next.startTime, next.endTime)
      if (!hoursTouched && d > 0) next.hours = String(Math.round(d * 2) / 2)
      return next
    })
  }

  function validate(draft: boolean) {
    const e: Record<string, string> = {}
    if (v.title.trim().length < 5) e.title = 'Give your opportunity a clear title (5+ characters).'
    if (!draft) {
      if (v.description.trim().length < 20) e.description = 'Describe what volunteers will do (20+ characters).'
      if (!v.category) e.category = 'Choose a category.'
      if (!v.date) e.date = 'Pick a date.'
      else if (!editing && v.date < todayISO()) e.date = 'The date can’t be in the past.'
      if (!v.endTime || durationHours(v.startTime, v.endTime) <= 0) e.endTime = 'End time must be after the start time.'
      if (!v.virtual) {
        if (!v.location.trim()) e.location = 'Enter the venue name.'
        if (!v.address.trim()) e.address = 'Enter the street address.'
      }
      if (!(Number(v.spots) >= 1)) e.spots = 'Enter at least 1 spot.'
      if (!(Number(v.hours) > 0)) e.hours = 'Enter the estimated hours.'
      if (v.minAge && !(Number(v.minAge) >= 1 && Number(v.minAge) <= 99)) e.minAge = 'Enter a valid age.'
      if (!v.deadline) e.deadline = 'Set a registration deadline.'
      else if (v.date && v.deadline > v.date) e.deadline = 'The deadline must be on or before the event date.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function submit(status: 'published' | 'draft') {
    if (!validate(status === 'draft')) {
      document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    onSubmit({
      title: v.title.trim(), description: v.description.trim(), category: v.category || 'Community Development', image: v.image,
      date: v.date || addDays(todayISO(), 14), startTime: v.startTime, endTime: v.endTime || v.startTime,
      location: v.virtual ? 'Online' : v.location.trim(), address: v.virtual ? 'Link sent after registration' : v.address.trim(),
      city: v.city, virtual: v.virtual, spots: Math.max(1, Number(v.spots) || 1), minAge: v.minAge ? Number(v.minAge) : null,
      skills: v.skills, hours: Number(v.hours) || 1, deadline: v.deadline || v.date, recurrence: v.recurrence,
      instructions: v.instructions.trim(), status,
    })
  }

  const previewImg = v.image ?? CATEGORY_IMAGE[v.category] ?? null

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit('published') }} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base">Basics</h2>
          <TextInput label="Opportunity title" placeholder="e.g. Saturday Pantry Packing Crew" value={v.title} onChange={(e) => set('title', e.target.value)} error={errors.title} />
          <TextArea label="Description" rows={5} placeholder="What will volunteers do? Why does it matter?" value={v.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
          <SelectInput label="Category" value={v.category} onChange={(e) => set('category', e.target.value)} error={errors.category}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </SelectInput>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base">Schedule</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Date" type="date" value={v.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
            <TextInput label="Start time" type="time" value={v.startTime} onChange={(e) => setTime('startTime', e.target.value)} />
            <TextInput label="End time" type="time" value={v.endTime} onChange={(e) => setTime('endTime', e.target.value)} error={errors.endTime} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="Recurring event" value={v.recurrence} onChange={(e) => set('recurrence', e.target.value as Recurrence)} hint="Recurring opportunities stay open for sign-ups.">
              <option value="none">Does not repeat</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Monthly</option>
            </SelectInput>
            <TextInput label="Registration deadline" type="date" value={v.deadline} onChange={(e) => set('deadline', e.target.value)} error={errors.deadline} />
          </div>
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base">Location</h2>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-ink">
            <input type="checkbox" className="size-4 accent-navy" checked={v.virtual} onChange={(e) => set('virtual', e.target.checked)} />
            This is a virtual opportunity
          </label>
          {!v.virtual && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Location name" placeholder="e.g. Eastside Community Center" value={v.location} onChange={(e) => set('location', e.target.value)} error={errors.location} />
                <SelectInput label="City" value={v.city} onChange={(e) => set('city', e.target.value)}>
                  {INDIANA_CITIES.map((c) => <option key={c}>{c}</option>)}
                </SelectInput>
              </div>
              <TextInput label="Street address" placeholder="123 Main St, Indianapolis, IN 46204" value={v.address} onChange={(e) => set('address', e.target.value)} error={errors.address} />
            </>
          )}
          {v.virtual && (
            <SelectInput label="Organizer city" value={v.city} onChange={(e) => set('city', e.target.value)}>
              {INDIANA_CITIES.map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
          )}
        </Card>

        <Card className="space-y-5 p-5 sm:p-6">
          <h2 className="text-base">Volunteer requirements</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Volunteer spots" type="number" min={1} value={v.spots} onChange={(e) => set('spots', e.target.value)} error={errors.spots} />
            <TextInput label="Estimated hours" type="number" min={0.5} step={0.5} value={v.hours} onChange={(e) => { setHoursTouched(true); set('hours', e.target.value) }} error={errors.hours} />
            <TextInput label="Minimum age" optional type="number" min={1} placeholder="None" value={v.minAge} onChange={(e) => set('minAge', e.target.value)} error={errors.minAge} />
          </div>
          <ChipSelect label="Required skills (optional)" options={SKILLS} value={v.skills} onChange={(s) => set('skills', s)} />
          <TextArea label="Additional instructions" optional rows={3} placeholder="Parking, what to wear, what to bring…" value={v.instructions} onChange={(e) => set('instructions', e.target.value)} />
        </Card>
      </div>

      <div className="space-y-6 lg:sticky lg:top-24">
        <Card className="p-5">
          <ImageUpload label="Event image" shape="wide" value={v.image} onChange={(img) => set('image', img)} hint="Optional. We’ll use a category photo if you skip this." />
        </Card>
        <Card className="overflow-hidden">
          <p className="border-b border-line px-4 py-2.5 text-xs font-semibold tracking-wide text-muted uppercase">Preview</p>
          <SafeImage src={previewImg} alt="" className="aspect-[16/9] w-full" />
          <div className="space-y-1.5 p-4">
            <p className="text-xs font-semibold text-navy-700">{v.category || 'Category'}</p>
            <p className="line-clamp-2 text-[15px] leading-snug font-bold text-navy">{v.title || 'Your opportunity title'}</p>
            <p className="flex items-center gap-1.5 pt-1 text-[13px] text-muted"><CalendarDays size={14} /> {v.date ? formatDate(v.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date'} · {formatTime(v.startTime)}</p>
            <p className="flex items-center gap-1.5 text-[13px] text-muted"><MapPin size={14} /> {v.virtual ? 'Virtual' : `${v.location || 'Location'}, ${v.city}`}</p>
            <p className="flex items-center gap-1.5 text-[13px] text-muted"><Clock size={14} /> {formatHours(Number(v.hours) || 0)} hrs · {v.spots || 0} spots</p>
          </div>
        </Card>
        <div className="flex flex-col gap-2">
          <Button type="submit" variant="accent" size="lg">{editing && initial?.status === 'published' ? 'Save changes' : 'Publish opportunity'}</Button>
          {(!editing || initial?.status === 'draft') && (
            <Button variant="secondary" size="lg" onClick={() => submit('draft')}>Save as draft</Button>
          )}
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </form>
  )
}
