import WebApp from '@twa-dev/sdk'

/** Открыто внутри Telegram, а не в обычном браузере */
export const inTelegram = WebApp.platform !== 'unknown'

export function initTelegram() {
  if (!inTelegram) return
  WebApp.ready()
  WebApp.expand()
  WebApp.setHeaderColor('#fbf3ea')
  WebApp.setBackgroundColor('#fbf3ea')
}

export interface TgUser {
  id: number
  name: string
  username?: string
}

export function currentUser(): TgUser {
  const u = WebApp.initDataUnsafe?.user
  if (u) {
    return { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' '), username: u.username }
  }
  return { id: 0, name: 'Гость' }
}

export function haptic(kind: 'light' | 'success' = 'light') {
  if (!inTelegram) return
  if (kind === 'success') WebApp.HapticFeedback.notificationOccurred('success')
  else WebApp.HapticFeedback.impactOccurred('light')
}

export function showMainButton(text: string, onClick: () => void) {
  if (!inTelegram) return () => {}
  WebApp.MainButton.setParams({ text, color: '#3a2a22', text_color: '#ffffff', is_visible: true })
  WebApp.MainButton.onClick(onClick)
  return () => {
    WebApp.MainButton.offClick(onClick)
    WebApp.MainButton.hide()
  }
}

export function showBackButton(onClick: () => void) {
  if (!inTelegram) return () => {}
  WebApp.BackButton.show()
  WebApp.BackButton.onClick(onClick)
  return () => {
    WebApp.BackButton.offClick(onClick)
    WebApp.BackButton.hide()
  }
}
