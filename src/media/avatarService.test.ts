import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadMock, getPublicUrlMock, updateProfileMock, getUserMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  updateProfileMock: vi.fn(),
  getUserMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock })),
    },
    auth: { getUser: getUserMock },
  },
}))

vi.mock('../lib/api/profiles', () => ({ updateProfile: updateProfileMock }))

import { MAX_AVATAR_SIZE_BYTES, uploadAvatar } from './avatarService'

describe('avatar uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar' },
    })
    getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    updateProfileMock.mockImplementation(async (patch) => ({ id: 'user-1', full_name: 'Kai', ...patch }))
  })

  it('rejects unsupported files before contacting Storage', async () => {
    const file = new File(['not an image'], 'avatar.svg', { type: 'image/svg+xml' })
    await expect(uploadAvatar(file, 'user-1')).rejects.toThrow('Choose a JPEG, PNG, or WebP image.')
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('rejects files over the client size limit', async () => {
    const file = new File([new Uint8Array(MAX_AVATAR_SIZE_BYTES + 1)], 'large.png', { type: 'image/png' })
    await expect(uploadAvatar(file, 'user-1')).rejects.toThrow('smaller than 5 MB')
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('uses the Auth user folder and persists the public URL in profiles.avatar_url', async () => {
    const file = new File(['image data'], 'profile.webp', { type: 'image/webp' })
    const result = await uploadAvatar(file, 'user-1')

    expect(uploadMock).toHaveBeenCalledWith('user-1/avatar', file, {
      cacheControl: '0',
      contentType: 'image/webp',
      upsert: true,
    })
    expect(updateProfileMock).toHaveBeenCalledWith({
      avatar_url: result.publicUrl,
    })
    expect(result.path).toBe('user-1/avatar')
    expect(result.publicUrl).toContain('v=')
    expect(result.profile.avatar_url).toBe(result.publicUrl)
  })

  it('surfaces a Storage failure', async () => {
    uploadMock.mockResolvedValue({ error: new Error('upload denied') })
    const file = new File(['image data'], 'profile.png', { type: 'image/png' })
    await expect(uploadAvatar(file, 'user-1')).rejects.toThrow('upload denied')
    expect(updateProfileMock).not.toHaveBeenCalled()
  })

  it('rejects a Storage owner that differs from the signed-in Auth user', async () => {
    const file = new File(['image data'], 'profile.png', { type: 'image/png' })
    await expect(uploadAvatar(file, 'another-user')).rejects.toThrow('your own profile')
    expect(uploadMock).not.toHaveBeenCalled()
    expect(updateProfileMock).not.toHaveBeenCalled()
  })

  it('does not report success if saving the profile URL fails', async () => {
    updateProfileMock.mockRejectedValue(new Error('Profile row missing'))
    const file = new File(['image data'], 'profile.png', { type: 'image/png' })
    await expect(uploadAvatar(file, 'user-1')).rejects.toThrow('Profile row missing')
  })

  it('requires an authenticated user before uploading', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const file = new File(['image data'], 'profile.png', { type: 'image/png' })
    await expect(uploadAvatar(file, 'user-1')).rejects.toThrow('Sign in before uploading')
    expect(uploadMock).not.toHaveBeenCalled()
  })
})
