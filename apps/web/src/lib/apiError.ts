/** Ответ сервера с ошибкой: по коду экран понимает, что сказать гостю */
export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(`API ${status}${code ? `: ${code}` : ''}`)
  }
}
