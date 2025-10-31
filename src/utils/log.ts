interface Log {
  silent: boolean;
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
 * Inicializa un logger con el ámbito especificado.
 * @param scope - El ámbito del logger.
 * @returns El objeto logger con métodos log y err.
 */
export function initLog(scope: string): Log {
  const log = {
    silent: true,
    log: (...messages: unknown[]) => logger(LogLevel.Info, scope, messages, log.silent),
    err: (...messages: unknown[]) => logger(LogLevel.Error, scope, messages, log.silent),
  };

  return log;
}
