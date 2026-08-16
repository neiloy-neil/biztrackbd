import { format as dateFnsFormat } from 'date-fns'
import { toZonedTime, format as formatTz } from 'date-fns-tz'

export const TIMEZONE = 'Asia/Dhaka'

/**
 * Formats a date in Bangladesh Standard Time (Asia/Dhaka).
 */
export function format(date: Date | string | number, formatStr: string): string {
  if (!date) return ''
  const d = new Date(date)
  const zonedDate = toZonedTime(d, TIMEZONE)
  return formatTz(zonedDate, formatStr, { timeZone: TIMEZONE })
}

/**
 * Ensures a Date object correctly represents a moment in the Dhaka timezone for local Date-fns calculations
 */
export function getDhakaTime(date: Date | string | number = new Date()): Date {
  return toZonedTime(new Date(date), TIMEZONE)
}
