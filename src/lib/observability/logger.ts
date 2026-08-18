export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface LogContext {
  requestId?: string
  userId?: string
  businessId?: string
  action?: string
  [key: string]: any
}

class Logger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }

    if (error) {
      if (error instanceof Error) {
        Object.assign(logEntry, {
          error_name: error.name,
          error_message: error.message,
          stack: error.stack,
        })
      } else {
        Object.assign(logEntry, {
          error_raw: error
        })
      }
    }

    return JSON.stringify(logEntry)
  }

  info(message: string, context?: LogContext) {
    console.log(this.formatLog('INFO', message, context))
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatLog('WARN', message, context))
  }

  error(message: string, error?: any, context?: LogContext) {
    console.error(this.formatLog('ERROR', message, context, error))
  }
}

export const logger = new Logger()
