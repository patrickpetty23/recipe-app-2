const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const levels = { error: 0, warn: 1, info: 2, debug: 3 };

function log(level, action, data = {}) {
  if (levels[level] > levels[LOG_LEVEL]) return;
  const entry = {
    level,
    action,
    timestamp: new Date().toISOString(),
    ...data
  };
  const output = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  info:  (action, data) => log('info',  action, data),
  debug: (action, data) => log('debug', action, data),
  warn:  (action, data) => log('warn',  action, data),
  error: (action, data) => log('error', action, data),
};
