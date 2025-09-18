import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, LogEntry } from './types';

/**
 * Structured logger with multiple output targets and log levels
 */
export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = 'info';
  private logToFile: boolean = false;
  private logDirectory: string = './logs';
  private logFileName: string = 'claude-api.log';
  private logToConsole: boolean = true;

  private constructor() {
    this.setupLogLevel();
    this.setupLogDirectory();
  }

  /**
   * Get singleton logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure logger settings
   */
  public configure(options: {
    logLevel?: LogLevel;
    logToFile?: boolean;
    logDirectory?: string;
    logToConsole?: boolean;
  }): void {
    if (options.logLevel) this.logLevel = options.logLevel;
    if (options.logToFile !== undefined) this.logToFile = options.logToFile;
    if (options.logDirectory) this.logDirectory = options.logDirectory;
    if (options.logToConsole !== undefined) this.logToConsole = options.logToConsole;
    
    if (this.logToFile) {
      this.setupLogDirectory();
    }
  }

  /**
   * Log debug message
   */
  public debug(message: string, component: string, metadata?: Record<string, any>): void {
    this.log('debug', message, component, metadata);
  }

  /**
   * Log info message
   */
  public info(message: string, component: string, metadata?: Record<string, any>): void {
    this.log('info', message, component, metadata);
  }

  /**
   * Log warning message
   */
  public warn(message: string, component: string, metadata?: Record<string, any>): void {
    this.log('warn', message, component, metadata);
  }

  /**
   * Log error message
   */
  public error(message: string, component: string, metadata?: Record<string, any>): void {
    this.log('error', message, component, metadata);
  }

  /**
   * Log error object
   */
  public logError(error: Error, component: string, context?: Record<string, any>): void {
    this.log('error', error.message, component, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, component: string, metadata?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      metadata
    };

    if (this.logToConsole) {
      this.logToConsoleOutput(logEntry);
    }

    if (this.logToFile) {
      this.logToFileOutput(logEntry);
    }
  }

  /**
   * Check if message should be logged based on log level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Output log entry to console with colors
   */
  private logToConsoleOutput(entry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    };
    const reset = '\x1b[0m';
    
    const color = colors[entry.level];
    const timestamp = entry.timestamp.substring(11, 19); // HH:MM:SS
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const componentStr = `[${entry.component}]`.padEnd(15);
    
    let output = `${color}${timestamp} ${levelStr}${reset} ${componentStr} ${entry.message}`;
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n${color}  └─${reset} ${JSON.stringify(entry.metadata, null, 2).replace(/\n/g, '\n     ')}`;
    }
    
    console.log(output);
  }

  /**
   * Output log entry to file
   */
  private logToFileOutput(entry: LogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      const logFilePath = path.join(this.logDirectory, this.logFileName);
      fs.appendFileSync(logFilePath, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Setup log level from environment
   */
  private setupLogLevel(): void {
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLogLevel && ['debug', 'info', 'warn', 'error'].includes(envLogLevel)) {
      this.logLevel = envLogLevel;
    }
  }

  /**
   * Setup log directory
   */
  private setupLogDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      try {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
        this.logToFile = false;
      }
    }
  }

  /**
   * Get current log level
   */
  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Rotate log files (called daily or when file gets too large)
   */
  public rotateLogFile(): void {
    if (!this.logToFile) return;

    try {
      const currentLogPath = path.join(this.logDirectory, this.logFileName);
      const timestamp = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
      const rotatedLogPath = path.join(this.logDirectory, `claude-api-${timestamp}.log`);
      
      if (fs.existsSync(currentLogPath)) {
        fs.renameSync(currentLogPath, rotatedLogPath);
        this.info('Log file rotated', 'Logger', { rotatedTo: rotatedLogPath });
      }
    } catch (error) {
      this.error('Failed to rotate log file', 'Logger', { error });
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();