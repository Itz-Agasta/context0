import winston from 'winston';
import Transport from 'winston-transport';
import "dotenv/config";

const { combine, timestamp, json, errors, align, printf, colorize } =
  winston.format;

const transports: Transport[] = [];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD hh:mm:ss A' }),
        align(),
        errors({ stack: true }),
        printf(({ timestamp: logTimestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? `\n${JSON.stringify(meta, null, 2)}`
            : '';

          return `${logTimestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
        })
      ),
    })
  );
} else {
  // Production: emit JSON logs (structured) and include error stacks
  transports.push(
    new winston.transports.Console({
      format: combine(
        timestamp(),
        errors({ stack: true }),
        json()
      ),
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports,
  silent: process.env.NODE_ENV === 'test',
});

export { logger };