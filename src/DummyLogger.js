/**
 * Silent logger, the default `Logger` environment option
 * @returns {import('#types').ILogger}
 */
export function DummyLogger() {
  return {
    debug() {},
    error() {},
    warn() {},
  };
}
