import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadMock, getPublicUrlMock, updateUserMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
  updateUserMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock })),
    },
    auth: { updateUser: updateUserMock },
  },
}))

import { MAX_AVATAR_SIZE_BYTES, uploadAvatar } from './avatarService'

describe('avatar uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadMock.mockResolvedValue({ error: null })
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar' },
    })
    updateUserMock.mockResolvedValue({ error: null })
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

  it('writes to the caller folder, upserts, and stores the URL on the auth profile', async () => {
    const file = new File(['image data'], 'profile.webp', { type: 'image/webp' })
    const result = await uploadAvatar(file, 'user-1')

    expect(uploadMock).toHaveBeenCalledWith('user-1/avatar', file, {
      cacheControl: '0',
      contentType: 'image/webp',
      upsert: true,
    })
    expect(updateUserMock).toHaveBeenCalledWith({
      data: { avatar_path: 'user-1/avatar', avatar_url: expect.stringContaining('https://project.supabase.co/') },
    })
    expect(result.path).toBe('user-1/avatar')
    expect(result.publicUrl).toContain('v=')
  })

  it('surfaces a Storage failure', async () => {
    uploadMock.mockResolvedValue({ error: new Error('upload denied') })
    const file = new File(['image data'], 'profile.png', { type: 'image/png' })
    await expect(uploadAvatar(file, 'user-1')).rejects.toThrow('upload denied')
    expect(updateUserMock).not.toHaveBeenCalled()
  })
})
