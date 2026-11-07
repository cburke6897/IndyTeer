const $ = (id) => document.getElementById(id)
let boot,
  items = [],
  status = {},
  selected,
  session,
  organizations = [],
  toastTimer
let visible = 20,
  previousSnapshot = '',
  lastRender = 0
const node = (tag, className, value) => {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (value !== undefined) el.textContent = value
  return el
}
function toast(message) {
  $('toast').textContent = message
  $('toast').hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ($('toast').hidden = true), 6500)
}
async function authFetch(path, body) {
  const response = await fetch(boot.project.supabaseUrl + '/auth/v1/' + path, {
    method: 'POST',
    headers: { apikey: boot.project.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error('Sign-in failed. Check your account, password and email confirmation.')
  return { ...data, expires_at: Date.now() + data.expires_in * 1000 }
}
async function api(path, body) {
  if (session && session.expires_at < Date.now() + 30000)
    session = await authFetch('token?grant_type=refresh_token', {
      refresh_token: session.refresh_token,
    })
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Discovery-Token': boot?.csrf || '',
      ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data
}
function readable(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Date to confirm'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date + 'T12:00:00Z'))
}
function fresh(value) {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 3600000))
  return hours < 1
    ? 'Checked just now'
    : hours < 24
      ? `Checked ${hours}h ago`
      : `Checked ${Math.floor(hours / 24)}d ago`
}
function link(label, url, className) {
  const a = node('a', className, label)
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  return a
}
function button(label, className, fn) {
  const b = node('button', className, label)
  b.type = 'button'
  b.addEventListener('click', fn)
  return b
}
function render() {
  lastRender = Date.now()
  $('stat-all').textContent = items.filter(
    (i) => !['excluded', 'duplicate'].includes(i.status),
  ).length
  $('stat-pending').textContent = items.filter((i) => i.status === 'pending').length
  $('stat-imported').textContent = items.filter((i) => i.status === 'imported').length
  $('stat-sources').textContent = (status.sources || []).filter((s) => s.enabled).length
  const q = $('search').value.toLowerCase(),
    filter = $('status').value
  const rows = items.filter(
    (i) =>
      (!filter || i.status === filter) &&
      `${i.title} ${i.organizer} ${i.location} ${i.city}`.toLowerCase().includes(q),
  )
  $('result-count').textContent = `${rows.length} ${rows.length === 1 ? 'listing' : 'listings'}`
  $('cards').replaceChildren()
  if (!rows.length) {
    const empty = node('div', 'empty')
    empty.append(
      node('span', 'empty-icon', '✦'),
      node(
        'strong',
        '',
        items.length ? 'Nothing in this view yet' : 'Your next good cause is out there.',
      ),
      node(
        'p',
        '',
        items.length
          ? 'Try another filter or discover new opportunities.'
          : 'Find real opportunities from approved sources. They will appear here for your review.',
      ),
    )
    $('cards').append(empty)
  }
  for (const item of rows.slice(0, visible)) {
    const card = node('article', 'opportunity-card'),
      top = node('div', 'card-top'),
      org = node('div', 'org-info'),
      name = node('div')
    name.append(node('strong', '', item.organizer), node('small', '', fresh(item.observedAt)))
    org.append(node('div', 'org-symbol', item.category === 'Environment' ? '♧' : '✦'), name)
    top.append(org, node('span', 'tag', item.category))
    const title = node('h3')
    title.append(link(item.title, item.sourceUrl, ''))
    card.append(top, title)
    const meta = node('div', 'meta')
    meta.append(
      node('span', '', `▦ ${readable(item.date)}${item.startTime ? ' · ' + item.startTime : ''}`),
      node(
        'span',
        '',
        `⌖ ${item.city || item.location.slice(0, 65) || 'Location to confirm'}${item.state ? ' · ' + item.state : ''}`,
      ),
    )
    card.append(meta, node('p', 'summary', item.summary))
    const bottom = node('div', 'card-bottom'),
      actions = node('div', 'card-actions')
    const notes = {
      pending: 'Review required · Capacity not verified',
      imported: 'Imported as a draft',
      rejected: 'Dismissed from review',
      withdrawn: 'Not in the latest source scan',
      excluded: 'Excluded by screening',
      duplicate: 'Possible duplicate — not auto-imported',
      expired: 'This session has ended',
    }
    const uncertain = item.import && ['pending', 'uncertain'].includes(item.import.status)
    bottom.append(
      node(
        'span',
        'status-note',
        uncertain
          ? 'Previous import needs reconciliation'
          : item.sourceMissing
            ? 'Source no longer lists this session — check your draft'
            : item.sourceChanged
              ? 'Source changed — check your draft'
              : notes[item.status] || item.status,
      ),
    )
    actions.append(
      link('Original listing ↗', item.applicationUrl || item.sourceUrl, 'button subtle'),
    )
    if (item.status === 'pending') {
      actions.append(
        button('Dismiss', 'dismiss', async () => {
          try {
            await api(`/api/listings/${item.id}/reject`, {})
            await refresh()
          } catch (e) {
            toast(e.message)
          }
        }),
      )
      actions.append(
        button(uncertain ? 'Reconcile' : 'Review & import', 'button primary', () =>
          uncertain ? reconcile(item) : review(item),
        ),
      )
    }
    bottom.append(actions)
    card.append(bottom)
    $('cards').append(card)
  }
  if (rows.length > visible)
    $('cards').append(
      button(`Show more (${rows.length - visible} remaining)`, 'button subtle', () => {
        visible += 20
        render()
      }),
    )
  $('sources').replaceChildren()
  for (const source of status.sources || []) {
    const el = node('div', 'source-item')
    el.append(
      link(source.name + ' ↗', source.permission.evidenceUrl, ''),
      node(
        'p',
        '',
        source.adapter === 'nps'
          ? 'Official API · Government source'
          : 'Approved source · Reuse reviewed',
      ),
      node(
        'p',
        source.run?.status === 'error' ? 'source-error' : '',
        source.run?.status === 'error'
          ? source.run.error
          : source.run?.last_success
            ? fresh(source.run.last_success)
            : 'Ready for first discovery',
      ),
    )
    $('sources').append(el)
  }
  $('scan').disabled = !!status.running
  $('scan').lastChild.textContent = status.running ? ' Discovering…' : ' Find opportunities'
  $('schedule').checked = !!status.scheduler
  const last = status.runs?.[0]
  $('scan-note').textContent = status.running
    ? 'Checking approved sources. Your main app is unchanged.'
    : last?.result?.errors?.length
      ? 'A source needs attention. See source details below.'
      : last?.result
        ? `${last.result.seen} source occurrences checked · ${last.result.skipped.length ? 'Some sources are waiting for their next scheduled check.' : 'Original signup links are preserved.'}`
        : 'Indiana first. Built to grow across the country.'
}
async function refresh() {
  const [feed, state] = await Promise.all([api('/api/listings'), api('/api/status')])
  const snapshot = JSON.stringify([feed.items, state])
  items = feed.items
  status = state
  if (snapshot !== previousSnapshot || Date.now() - lastRender > 60000) {
    previousSnapshot = snapshot
    render()
  }
}
function connect() {
  if (session) {
    session = undefined
    organizations = []
    $('account').textContent = 'Connect account'
    toast('Disconnected from this module. Your main app session is unchanged.')
    return
  }
  if (!boot.project.importsEnabled) {
    toast(
      'Draft imports are not enabled. You can still browse, scan and follow original signup links.',
    )
    return
  }
  $('login-error').textContent = ''
  $('login-dialog').showModal()
}
function review(item) {
  selected = item
  if (!session) {
    connect()
    return
  }
  if (!organizations.length) {
    toast('This account needs an active owner or admin membership to import drafts.')
    return
  }
  $('review-title').textContent = item.title
  $('review-source').textContent =
    `External organizer: ${item.organizer}. ${fresh(item.observedAt)}. Imported drafts will retain the original listing link.`
  $('review-notes').textContent = item.reasons.join(' · ')
  $('organization').replaceChildren(
    ...organizations.map((o) => {
      const option = node('option', '', o.name)
      option.value = o.id
      return option
    }),
  )
  for (const key of ['date', 'city', 'location', 'startTime', 'endTime', 'timezone', 'category'])
    $(key).value = item[key] || ''
  $('capacity').value = ''
  $('facts-confirmed').checked = false
  $('authorization-confirmed').checked = false
  $('review-error').textContent = ''
  $('review-dialog').showModal()
}
async function reconcile(item) {
  if (!session) {
    connect()
    return
  }
  try {
    const result = await api(`/api/listings/${item.id}/reconcile`, {})
    toast(`Confirmed existing draft ${result.id}.`)
    await refresh()
  } catch (e) {
    toast(e.message)
  }
}
$('search').addEventListener('input', () => {
  visible = 20
  render()
})
$('status').addEventListener('change', () => {
  visible = 20
  render()
})
$('account').addEventListener('click', connect)
document
  .querySelectorAll('[data-close]')
  .forEach((b) => b.addEventListener('click', () => $(b.dataset.close).close()))
$('scan').addEventListener('click', async () => {
  try {
    await api('/api/collect', {})
    toast('Discovery started. New results will appear automatically.')
    await refresh()
  } catch (e) {
    toast(e.message)
  }
})
$('schedule').addEventListener('change', async () => {
  try {
    await api('/api/scheduler', { enabled: $('schedule').checked })
    toast(
      $('schedule').checked
        ? 'Automatic discovery enabled while this module is running.'
        : 'Automatic discovery paused.',
    )
    await refresh()
  } catch (e) {
    toast(e.message)
  }
})
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const b = e.submitter
  b.disabled = true
  $('login-error').textContent = ''
  try {
    session = await authFetch('token?grant_type=password', {
      email: $('email').value.trim(),
      password: $('password').value,
    })
    const account = await api('/api/session', {})
    organizations = account.organizations
    $('password').value = ''
    $('login-dialog').close()
    $('account').textContent = 'Disconnect account'
    toast('Account connected. Imports are limited to your managed organizations.')
    if (selected) review(selected)
  } catch (error) {
    session = undefined
    $('password').value = ''
    $('login-error').textContent = error.message
  } finally {
    b.disabled = false
  }
})
$('review-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const b = e.submitter
  b.disabled = true
  $('review-error').textContent = ''
  const fields = Object.fromEntries(
    ['date', 'city', 'location', 'startTime', 'endTime', 'timezone', 'category', 'capacity'].map(
      (k) => [k, $(k).value],
    ),
  )
  try {
    await api(`/api/listings/${selected.id}/import`, {
      ...fields,
      organizationId: $('organization').value,
      factsConfirmed: $('facts-confirmed').checked,
      authorizationConfirmed: $('authorization-confirmed').checked,
    })
    $('review-dialog').close()
    toast('Draft imported. Review and publish it from your organization workspace.')
    await refresh()
  } catch (error) {
    $('review-error').textContent = error.message
  } finally {
    b.disabled = false
  }
})
try {
  boot = await api('/api/bootstrap')
  await refresh()
  setInterval(() => refresh().catch(() => {}), 4000)
} catch (error) {
  toast('The local discovery service is unavailable: ' + error.message)
}
