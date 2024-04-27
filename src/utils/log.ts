interface Log {
  log: (...messages: unknown[]) => void;
  err: (...messages: unknown[]) => void;
}

enum LogLevel {
  Info = "INFO",
  Error = "ERROR",
}

function logger(level: LogLevel, scope: string, messages: unknown[], silent: boolean) {
  if (silent) {
    return;
  }
  process.stdout.write(`[${level}] [${scope}] `);
  for (const message of messages) {
    if (typeof message === "object") {
      process.stdout.write("\n" + JSON.stringify(message) + "\n");
    }
    process.stdout.write(`${message}`);
  }
  process.stdout.write("\n");
}

/**
 * Initializes a logger with the specified scope.
 * @param scope - The scope of the logger.
 * @returns The logger object with log and err methods.
 */
export function initLog(scope: string): Log {
  const log = {
    silent: false,
    log: (...messages: unknown[]) => logger(LogLevel.Info, scope, messages, log.silent),
    err: (...messages: unknown[]) => logger(LogLevel.Error, scope, messages, log.silent),
  };

  return log;
}
