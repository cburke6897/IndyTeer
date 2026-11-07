import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  storage: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  select: vi.fn(),
}))
vi.mock('./client', () => ({
  db: { auth: { getUser: mock.getUser }, from: mock.from, storage: { from: mock.storage } },
}))
import { uploadAvatar, validateImage, MAX_IMAGE_BYTES } from './storage'
const file = () => new File(['picture'], 'photo.png', { type: 'image/png' })

describe('persisted avatar uploads', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mock.getUser.mockResolvedValue({ data: { user: { id: 'auth-user-id' } }, error: null })
    const builder = { select: mock.select, eq: mock.eq, single: mock.single, update: mock.update }
    mock.from.mockReturnValue(builder)
    mock.select.mockReturnValue(builder)
    mock.eq.mockReturnValue(builder)
    mock.update.mockReturnValue(builder)
    mock.single
      .mockResolvedValueOnce({ data: { avatar_path: 'auth-user-id/old.png' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'auth-user-id' }, error: null })
    mock.storage.mockReturnValue({
      upload: mock.upload,
      remove: mock.remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: 'https://storage.test/' + path } }),
    })
    mock.upload.mockResolvedValue({ error: null })
    mock.remove.mockResolvedValue({ error: null })
  })
  it('uses the Auth ID folder and persists path and URL before removing the old file', async () => {
    const image = await uploadAvatar(file())
    expect(image.path).toMatch(/^auth-user-id\/.+\.png$/)
    expect(mock.update).toHaveBeenCalledWith({ avatar_path: image.path, avatar_url: image.url })
    expect(mock.eq).toHaveBeenCalledWith('id', 'auth-user-id')
    expect(mock.remove).toHaveBeenCalledWith(['auth-user-id/old.png'])
    expect(mock.update.mock.invocationCallOrder[0]).toBeLessThan(
      mock.remove.mock.invocationCallOrder[0],
    )
  })
  it('removes the new orphan and preserves the old avatar if profile persistence fails', async () => {
    mock.single
      .mockReset()
      .mockResolvedValueOnce({ data: { avatar_path: 'auth-user-id/old.png' } })
      .mockResolvedValueOnce({ error: new Error('Profile update denied') })
    await expect(uploadAvatar(file())).rejects.toThrow('Profile update denied')
    const uploadedPath = mock.upload.mock.calls[0][0]
    expect(mock.remove).toHaveBeenCalledExactlyOnceWith([uploadedPath])
  })
  it('rejects unsupported, empty, and oversized files before upload', async () => {
    expect(() => validateImage(new File(['svg'], 'a.svg', { type: 'image/svg+xml' }))).toThrow(
      'JPEG',
    )
    expect(() => validateImage(new File([], 'a.png', { type: 'image/png' }))).toThrow('empty')
    expect(() =>
      validateImage(
        new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'a.png', { type: 'image/png' }),
      ),
    ).toThrow('2 MB')
    mock.getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(uploadAvatar(file())).rejects.toThrow('Sign in')
    expect(mock.upload).not.toHaveBeenCalled()
  })
})
