import { env } from "../env";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    timestamp: string;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const MIN_LEVEL: LogLevel = env.LOG_LEVEL;

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[MIN_LEVEL]) return;

    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
    };

    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }

    const output = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
        console.error(output);
    } else {
        console.log(output);
    }
}

export const logger = {
    debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
    info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
