/** 解析库内时间字段（ISO UTC 或 SQLite 的 UTC 文本） */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseStoredTime(s: string): Date {
  const t = s.trim()
  if (!t) return new Date(NaN)
  // SQLite: YYYY-MM-DD HH:MM:SS（文档为 UTC）
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(t)) {
    return new Date(t.replace(' ', 'T') + 'Z')
  }
  return new Date(t)
}

/** 按本机时区格式化为 YYYY-MM-DD HH:mm:ss */
export function formatLocalDateTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** 按本机日历日 YYYY-MM-DD */
export function formatLocalDateYmd(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 将库中时间格式化为本机显示的日期时间字符串 */
export function formatStoredAsLocal(s: string): string {
  const d = parseStoredTime(s)
  if (Number.isNaN(d.getTime())) return s.slice(0, 19).replace('T', ' ')
  return formatLocalDateTime(d)
}

/**
 * 本地日历日 dateStr（YYYY-MM-DD）对应的 UTC 时间闭区间，
 * 用于与库中 ISO 字符串比较（与日记所选「本地日」一致）。
 */
export function utcBoundsForLocalCalendarDay(dateStr: string): { start: string; end: string } {
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid date string: ${dateStr}`)
  }
  const [y, m, d] = parts
  const startLocal = new Date(y, m - 1, d, 0, 0, 0, 0)
  const endLocal = new Date(y, m - 1, d, 23, 59, 59, 999)
  return { start: startLocal.toISOString(), end: endLocal.toISOString() }
}
