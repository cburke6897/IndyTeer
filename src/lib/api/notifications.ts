import { db } from './client'
import type { Notification } from '../../types/models'

export async function listNotifications(limit = 30): Promise<Notification[]> {
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError) throw new Error(authError.message)
  if (!user) throw new Error('Sign in to view notifications.')
  const { data, error } = await db.from('notifications').select('*').eq('user_id', user.id)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data as Notification[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await db.rpc('mark_notification_read', { p_notification_id: id })
  if (error) throw new Error(error.message)
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await db.rpc('mark_all_notifications_read')
  if (error) throw new Error(error.message)
}
