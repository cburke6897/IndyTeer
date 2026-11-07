import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getProfileMock } = vi.hoisted(() => ({ getProfileMock: vi.fn() }))
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'auth-user-1', email: 'kai@example.org', user_metadata: { full_name: 'Metadata Name', avatar_url: 'https://example.org/old.png' } },
    signOut: vi.fn(),
  }),
}))
vi.mock('../lib/api/profiles', () => ({ getProfile: getProfileMock }))
vi.mock('../media/avatarService', () => ({ uploadAvatar: vi.fn() }))

import { ProfilePage } from './ProfilePage'

describe('profile contract', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads profiles by Auth ID and renders database name and avatar instead of Auth metadata', async () => {
    getProfileMock.mockResolvedValue({ id: 'auth-user-1', full_name: 'Database Name', avatar_url: 'https://example.org/database.png' })
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Hi, Database Name' })).toBeInTheDocument()
    expect(getProfileMock).toHaveBeenCalledWith('auth-user-1')
    expect(screen.getByRole('img', { name: "Database Name's avatar" })).toHaveAttribute('src', 'https://example.org/database.png')
    expect(screen.queryByText('Hi, Metadata Name')).not.toBeInTheDocument()
  })

  it('shows a profile load failure and prevents upload when the trigger-created row is missing', async () => {
    getProfileMock.mockRejectedValue(new Error('Profile row missing'))
    render(<MemoryRouter><ProfilePage /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Profile row missing')
    expect(screen.queryByRole('button', { name: 'Upload photo' })).not.toBeInTheDocument()
  })
})
