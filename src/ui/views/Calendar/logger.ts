/**
 * Calendar Logger (v3.0.0)
 * 
 * Centralized logging for Calendar module with:
 * - Log levels (debug, info, warn, error)
 * - Production mode detection (auto-disable debug logs)
 * - Structured logging with context
 * - Performance timing utilities
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogContext {
  component?: string;
  action?: string;
  data?: Record<string, unknown>;
}

// Production detection - disable verbose logs in production
const isProduction = process.env['NODE_ENV'] === 'production';

// Default log level based on environment
let currentLogLevel: LogLevel = isProduction ? LogLevel.WARN : LogLevel.DEBUG;

/**
 * Set the minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Get current log level
 */
export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

/**
 * Format log message with context
 */
function formatMessage(message: string, context?: LogContext): string {
  const parts = ['[Calendar]'];
  
  if (context?.component) {
    parts.push(`[${context.component}]`);
  }
  
  if (context?.action) {
    parts.push(`(${context.action})`);
  }
  
  parts.push(message);
  
  return parts.join(' ');
}

/**
 * Calendar logger instance
 */
export const calendarLogger = {
  /**
   * Debug level - verbose development logs
   * Disabled in production
   */
  debug(message: string, context?: LogContext): void {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.debug(formatMessage(message, context), context?.data ?? '');
    }
  },

  /**
   * Info level - general information
   */
  info(message: string, context?: LogContext): void {
    if (currentLogLevel <= LogLevel.INFO) {
      // Using console.debug for info level (console.log/info not recommended per Obsidian guidelines)
      console.debug(formatMessage(message, context), context?.data ?? '');
    }
  },

  /**
   * Warn level - potential issues
   */
  warn(message: string, context?: LogContext): void {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(formatMessage(message, context), context?.data ?? '');
    }
  },

  /**
   * Error level - errors that need attention
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(formatMessage(message, context), error ?? '', context?.data ?? '');
    }
  },

  /**
   * Performance timing utility
   * Returns a function to call when operation completes
   */
  time(label: string, context?: LogContext): () => void {
    if (currentLogLevel > LogLevel.DEBUG) {
      return () => {}; // No-op in production
    }
    
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.debug(`${label} took ${duration.toFixed(2)}ms`, context);
    };
  },

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    switch (level) {
      case LogLevel.DEBUG:
        this.debug(message, context);
        break;
      case LogLevel.INFO:
        this.info(message, context);
        break;
      case LogLevel.WARN:
        this.warn(message, context);
        break;
      case LogLevel.ERROR:
        this.error(message, undefined, context);
        break;
    }
  },
};

// Convenience aliases for common components
export const logCalendarView = (message: string, data?: Record<string, unknown>) =>
  calendarLogger.debug(message, data ? { component: 'CalendarView', data } : { component: 'CalendarView' });

export const logProcessor = (message: string, data?: Record<string, unknown>) =>
  calendarLogger.debug(message, data ? { component: 'Processor', data } : { component: 'Processor' });

export const logTimeline = (message: string, data?: Record<string, unknown>) =>
  calendarLogger.debug(message, data ? { component: 'Timeline', data } : { component: 'Timeline' });

export const logInfiniteScroll = (message: string, data?: Record<string, unknown>) =>
  calendarLogger.debug(message, data ? { component: 'InfiniteScroll', data } : { component: 'InfiniteScroll' });

export default calendarLogger;
