/** Ответ сервера с ошибкой: status 0 значит, что до сервера не достучались */
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`API ${status} ${code}`)
  }
}

/** Что сказать гостю, если заказ не прошёл. Повтор помогает только при сбое связи */
export function orderErrorText(e: unknown): string {
  const status = e instanceof ApiError ? e.status : 0
  const code = e instanceof ApiError ? e.code : ''
  if (status === 401) return 'Сессия устарела. Закройте мини-апп и откройте его снова из бота.'
  if (status === 429) return 'Слишком много заказов подряд. Подождите несколько минут или позвоните нам.'
  if (code === 'pickup time passed') return 'Это время уже прошло. Выберите другое время и нажмите «Заказать».'
  if (code === 'shop closed') return 'Кофейня в это время не работает. Выберите другое время.'
  if (code === 'free coffee not available') return 'Бесплатный кофе сейчас недоступен: возможно, он уже ждёт вас в другом заказе. Снимите галочку и закажите снова.'
  if (status >= 400 && status < 500) return 'Заказ не принят. Проверьте корзину или позвоните нам.'
  if (status >= 500) return 'На сервере сбой. Попробуйте ещё раз через минуту: второй заказ не появится.'
  return 'Заказ не отправился. Проверьте интернет и нажмите «Заказать» ещё раз: второй заказ не появится.'
}
