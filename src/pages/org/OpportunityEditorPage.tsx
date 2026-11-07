import { useNavigate, useParams } from 'react-router-dom'
import { OpportunityForm } from '../../components/domain/OpportunityForm'
import { PageHeader } from '../../components/ui/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/Button'
import { useSession } from '../../store/session'
import { getOpp } from '../../store/selectors'
import { createOpportunity, updateOpportunity } from '../../store/actions'
import { act } from '../../store/act'

export default function OpportunityEditorPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const { db, org } = useSession()
  const navigate = useNavigate()
  const existing = mode === 'edit' ? getOpp(db, id) : undefined

  if (mode === 'edit' && (!existing || existing.orgId !== org!.id)) {
    return <EmptyState title="Opportunity not found" action={<LinkButton to="/org/opportunities" variant="primary">Back to opportunities</LinkButton>} />
  }

  return (
    <div>
      <PageHeader
        title={mode === 'create' ? 'Create opportunity' : 'Edit opportunity'}
        description={mode === 'create' ? 'Published opportunities appear instantly in your list and in volunteers’ feeds.' : 'Changes are visible to volunteers immediately.'}
      />
      <OpportunityForm
        key={existing?.id ?? 'new'}
        initial={existing}
        onCancel={() => navigate('/org/opportunities')}
        onSubmit={async (values) => {
          const done = existing
            ? await act(updateOpportunity(existing.id, values).then(() => true), values.status === 'published' ? 'Opportunity updated.' : 'Draft saved.')
            : await act(createOpportunity(org!.id, values).then(() => true), values.status === 'published' ? 'Opportunity published. It’s now live in the volunteer feed.' : 'Draft saved.')
          if (done) navigate('/org/opportunities')
        }}
      />
    </div>
  )
}
