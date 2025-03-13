function log(type, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📝',
    error: '❌',
    warning: '⚠️',
    debug: '🔍',
    config: '⚙️',
    email: '📧',
    ai: '🤖'
  }[type] || '💡';

  console.log(`${timestamp} ${prefix} ${message}`);
}

module.exports = { log };