import './schema.js'

// Process launch facts, captured at module initialization.
export const PROCESS_START_TIME = Date.now()
export const IS_RESUME_LAUNCH = process.argv.some(
  arg =>
    arg === '-c' ||
    arg === '--continue' ||
    arg === '-r' ||
    arg === '--resume' ||
    arg.startsWith('--resume='),
)
