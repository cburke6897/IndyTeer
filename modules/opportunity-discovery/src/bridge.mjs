import { validateReview } from './model.mjs'

export class Bridge {
  constructor(config, store, fetcher = fetch) {
    this.config = config
    this.store = store
    this.fetcher = fetcher
  }
  async request(path, token, options = {}) {
    const response = await this.fetcher(this.config.supabaseUrl + path, {
      ...options,
      headers: {
        apikey: this.config.publishableKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const error = new Error(
        `Supabase rejected the request (${response.status}). Check your session and organization permissions.`,
      )
      error.status = response.status
      throw error
    }
    return body
  }
  async session(token) {
    if (!this.config.importsEnabled)
      throw new Error(
        'Draft imports are disabled. Configure the module before connecting an account.',
      )
    if (!token || token.length > 10000) throw new Error('Sign in to continue.')
    const user = await this.request('/auth/v1/user', token)
    if (!user?.id) throw new Error('Your Auth session could not be verified.')
    const memberships = await this.request(
      '/rest/v1/organization_memberships?' +
        new URLSearchParams({
          select: 'organization_id,role,status',
          user_id: `eq.${user.id}`,
          status: 'eq.active',
          role: 'in.(owner,admin)',
        }),
      token,
    )
    const ids = memberships.map((m) => m.organization_id)
    const organizations = ids.length
      ? await this.request(
          '/rest/v1/organizations?' +
            new URLSearchParams({ select: 'id,name', id: `in.(${ids.join(',')})` }),
          token,
        )
      : []
    return { userId: user.id, organizations }
  }
  marker(id) {
    return `[IndyTeer Discovery:${id}]`
  }
  async find(id, organizationId, token) {
    return await this.request(
      '/rest/v1/opportunities?' +
        new URLSearchParams({
          select: 'id,organization_id,instructions,status',
          organization_id: `eq.${organizationId}`,
          instructions: `like.*${this.marker(id)}*`,
        }),
      token,
    )
  }
  async reconcile(id, token) {
    const session = await this.session(token),
      journal = this.store.import(id)
    if (!journal || !session.organizations.some((o) => o.id === journal.organization_id))
      throw new Error('No accessible import to reconcile.')
    const rows = await this.find(id, journal.organization_id, token)
    if (rows.length !== 1)
      throw new Error(
        'No unique confirmed result yet. Import stays blocked; inspect the organization drafts before any manual retry.',
      )
    this.store.imported(id, rows[0].id)
    return { id: rows[0].id, status: rows[0].status, reconciled: true }
  }
  async import(id, review, token) {
    const record = this.store.get(id)
    if (!record) throw new Error('Listing not found.')
    const fields = validateReview(record, review)
    const session = await this.session(token)
    if (!session.organizations.some((o) => o.id === fields.organizationId))
      throw new Error('Only an active organization owner or admin may import drafts.')
    const previous = this.store.import(id)
    if (previous?.status === 'imported') {
      if (previous.organization_id !== fields.organizationId)
        throw new Error('This listing was already imported into another organization.')
      const rows = await this.find(id, fields.organizationId, token)
      if (rows.length !== 1)
        throw new Error(
          'The previous draft is no longer uniquely accessible. No replacement was created.',
        )
      return { id: rows[0].id, status: rows[0].status, alreadyImported: true }
    }
    if (previous)
      throw new Error(
        'The previous import is unresolved. Reconcile it instead of creating a duplicate.',
      )
    const found = await this.find(id, fields.organizationId, token)
    this.store.reserve(id, fields.organizationId, session.userId)
    if (found.length === 1) {
      this.store.imported(id, found[0].id)
      return { id: found[0].id, alreadyImported: true }
    }
    if (found.length > 1) {
      this.store.uncertain(id)
      throw new Error('Multiple existing drafts match this source; manual review is required.')
    }
    const payload = {
      organization_id: fields.organizationId,
      title: record.title,
      description: record.summary,
      category: fields.category,
      city: fields.city,
      location: fields.location,
      virtual: false,
      skills: [],
      hours: null,
      min_age: null,
      event_date: fields.date,
      start_time: fields.startTime,
      end_time: fields.endTime,
      timezone: fields.timezone,
      spots: fields.capacity,
      recurrence: 'none',
      instructions: `${this.marker(id)}\nExternal organizer: ${record.organizer}\nOriginal listing: ${record.sourceUrl}\nOriginal registration: ${record.applicationUrl}\nSource checked: ${record.observedAt}\nImported as a draft by an authorized organization representative. Verify original availability before publishing.`,
    }
    try {
      // Omit id and status: main grants column-level INSERT permissions and defaults to draft.
      const rows = await this.request('/rest/v1/opportunities', token, {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      })
      if (!Array.isArray(rows) || rows.length !== 1 || !rows[0].id) {
        this.store.uncertain(id)
        throw new Error('The server did not confirm a unique draft. Reconcile before retrying.')
      }
      this.store.imported(id, rows[0].id)
      return { id: rows[0].id, status: rows[0].status || 'draft' }
    } catch (error) {
      if (error.status >= 400 && error.status < 500) this.store.failed(id)
      else this.store.uncertain(id)
      throw error
    }
  }
}
