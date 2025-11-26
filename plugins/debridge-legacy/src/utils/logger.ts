/**
 * Structured logging utility
 * Provides consistent, queryable log output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = 'info') {
    this.context = context;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private formatLog(entry: LogEntry): string {
    const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}${meta}`;
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  /**
   * Create a child logger with extended context
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.minLevel);
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Mark a checkpoint
   */
  mark(label: string): void {
    this.marks.set(label, Date.now());
  }

  /**
   * Get elapsed time since start
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get time between two marks
   */
  measure(startMark: string, endMark: string): number | undefined {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    if (!start || !end) return undefined;
    return end - start;
  }

  /**
   * Get all marks as metadata
   */
  getMetadata(): Record<string, number> {
    const metadata: Record<string, number> = {
      totalMs: this.elapsed(),
    };
    
    for (const [label, time] of this.marks.entries()) {
      metadata[`${label}Ms`] = time - this.startTime;
    }
    
    return metadata;
  }
}

