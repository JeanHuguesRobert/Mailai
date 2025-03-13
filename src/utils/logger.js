import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

console.log(`Chalk loaded: ${chalk.blue}`); // Debugging line to check chalk
console.log(`Chalk type: ${typeof chalk}`); // Log the type of chalk
console.log(`Available chalk functions: ${JSON.stringify(Object.keys(chalk))}`); // Log available color functions

class Logger {
  constructor() {
    this.logDir = 'logs';
    this.logToFile = process.env.MAILAI_LOG_TO_FILE === 'true'; // Check the environment variable
    this.useColor = process.env.MAILAI_USE_COLOR === 'true'; // Check for color usage
    console.log(`MAILAI_USE_COLOR: ${this.useColor}`); // Debugging line
    this.entered = false; // Flag to detect recursive calls

    // Create logs directory if it doesn't exist
    if (this.logToFile && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }

    // Create mode-specific log file
    const mode = process.env.MAILAI_mode || 'development';
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `mailai-${date}.log`);
    this.modeLogFile = path.join(this.logDir, `mailai-${mode}-${date}.log`);

    // Add startup marker to mode log
    const startupMessage = `\n=== ${mode.toUpperCase()} MODE STARTED AT ${new Date().toISOString()} ===\n`;
    if (this.logToFile) {
      fs.appendFileSync(this.modeLogFile, startupMessage);
    }
  }

  getLogLevel() {
    const mode = process.env.MAILAI_mode || 'development';
    switch(mode) {
      case 'production':
        return 'info';  // Only important info, warnings, and errors
      case 'development':
        return 'debug'; // All logs including debug
      case 'testing':
        return 'debug'; // All logs for testing
      case 'dry_run':
        return 'debug'; // All logs to verify what would happen
      default:
        return 'info';
    }
  }

  shouldLog(level) {
    const levels = {
      debug: 0,
      info: 1,
      warning: 2,
      error: 3
    };

    const currentLevel = levels[this.getLogLevel()];
    const messageLevel = levels[level];

    return messageLevel >= currentLevel;
  }

  formatMessage(level, message, emoji = '') {
    const timestamp = new Date().toISOString();
    const prefix = level.toUpperCase().padEnd(7);
    const mode = process.env.MAILAI_mode || 'development';
    return `${timestamp} [${mode}] ${prefix} ${emoji} ${message}`;
  }

  writeToFile(message) {
    // Write to main log file if logging to file is enabled
    if (this.logToFile) {
      fs.appendFileSync(this.logFile, message + '\n');
      fs.appendFileSync(this.modeLogFile, message + '\n');
    }
  }

  log(level, message, emoji = '') {
    if (this.entered) {
      console.log(`Recursive call detected: ${message}`);
      return;
    }
    this.entered = true;

    console.log(`Logging level before assignment: ${level}`); // Debugging line to check level

    // Log available colors from chalk
    console.log(`Chalk colors: ${JSON.stringify(chalk.colors)}`); // Debugging line to check chalk colors

    // Directly access color functions from chalk
    const colorFn = this.useColor ? chalk[level] : chalk.white;
    if (!colorFn) {
      console.warn(`Invalid log level: ${level}. Defaulting to white.`);
      level = 'info'; // Default to 'info' if invalid
    }

    if (!this.shouldLog(level)) {
      this.entered = false;
      return;
    }

    const formattedMessage = this.formatMessage(level, message, emoji);
    this.writeToFile(formattedMessage);

    // Console output with colors
    const mode = process.env.MAILAI_mode || 'development';
    if (mode !== 'production') {
      if (mode === 'dry_run') {
        console.log(chalk.cyan('🔍 [DRY RUN] ') + colorFn(formattedMessage));
      } else if (mode === 'testing') {
        console.log(chalk.magenta('🧪 [TEST] ') + colorFn(formattedMessage));
      } else {
        console.log(colorFn(formattedMessage));
      }
    }

    this.entered = false;
  }

  debug(message) {
    this.log('debug', message, '🔍');
  }

  info(message) {
    this.log('info', message, '📝');
  }

  warning(message) {
    this.log('warning', message, '⚠️');
  }

  error(message) {
    this.log('error', message, '❌');
  }

  dryRun(message) {
    if (process.env.MAILAI_mode === 'dry_run') {
      this.log('info', `[DRY RUN] ${message}`, '🔍');
    }
  }

  test(message) {
    if (process.env.MAILAI_mode === 'testing') {
      this.log('info', `[TEST] ${message}`, '🧪');
    }
  }

  plugin(message) {
    this.log('info', `[Plugin] ${message}`, '🔌');
  }

  email(message) {
    this.log('info', `[Email] ${message}`, '📧');
  }

  ai(message) {
    this.log('info', `[AI] ${message}`, '🤖');
  }

  imap(message) {
    this.log('info', `[IMAP] ${message}`, 'imap');
  }
}

export default new Logger();