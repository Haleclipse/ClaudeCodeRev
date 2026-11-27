import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import { setScheduledTasksEnabled } from '../../bootstrap/state.js'
import { TICK_TAG } from '../../constants/xml.js'
import type { ValidationResult } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { cronToHuman, parseCronExpression } from '../../utils/cron.js'
import {
  addCronTask,
  getCronFilePath,
  listAllCronTasks,
  nextCronRunMs,
} from '../../utils/cronTasks.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { semanticBoolean } from '../../utils/semanticBoolean.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { plural } from '../../utils/stringUtils.js'
import { getTeammateContext } from '../../utils/teammateContext.js'
import {
  buildCronCreateDescription,
  buildCronCreatePrompt,
  CRON_CREATE_TOOL_NAME,
  DEFAULT_MAX_AGE_DAYS,
  isDurableCronEnabled,
  isKairosCronEnabled,
} from './prompt.js'
import { renderCreateResultMessage, renderCreateToolUseMessage } from './UI.js'

const DEFAULT_MIN_TICK_INTERVAL_MINUTES = 2

/* eslint-disable @typescript-eslint/no-require-imports */
const proactiveModule =
  feature('PROACTIVE') || feature('KAIROS')
    ? require('../../proactive/index.js')
    : null
/* eslint-enable @typescript-eslint/no-require-imports */

const MAX_JOBS = 50

const inputSchema = lazySchema(() =>
  z.strictObject({
    cron: z
      .string()
      .describe(
        'Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "*/5 * * * *" = every 5 minutes, "30 14 28 2 *" = Feb 28 at 2:30pm local once).',
      ),
    prompt: z.string().describe('The prompt to enqueue at each fire time.'),
    recurring: semanticBoolean(z.boolean().optional()).describe(
      `true (default) = fire on every cron match until deleted or auto-expired after ${DEFAULT_MAX_AGE_DAYS} days. false = fire once at the next match, then auto-delete. Use false for "remind me at X" one-shot requests with pinned minute/hour/dom/month.`,
    ),
    durable: semanticBoolean(z.boolean().optional()).describe(
      'true = persist to .claude/scheduled_tasks.json and survive restarts. false (default) = in-memory only, dies when this Claude session ends. Use true only when the user asks the task to survive across sessions.',
    ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    id: z.string(),
    humanSchedule: z.string(),
    recurring: z.boolean(),
    durable: z.boolean().optional(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type CreateOutput = z.infer<OutputSchema>

export const CronCreateTool = buildTool({
  name: CRON_CREATE_TOOL_NAME,
  searchHint: 'schedule a recurring or one-shot prompt',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isEnabled() {
    return isKairosCronEnabled()
  },
  toAutoClassifierInput(input) {
    return `${input.cron}: ${input.prompt}`
  },
  async description() {
    return buildCronCreateDescription(isDurableCronEnabled())
  },
  async prompt() {
    return buildCronCreatePrompt(isDurableCronEnabled())
  },
  getPath() {
    return getCronFilePath()
  },
  async validateInput(input): Promise<ValidationResult> {
    if (!parseCronExpression(input.cron)) {
      return {
        result: false,
        message: `Invalid cron expression '${input.cron}'. Expected 5 fields: M H DoM Mon DoW.`,
        errorCode: 1,
      }
    }
    if (nextCronRunMs(input.cron, Date.now()) === null) {
      return {
        result: false,
        message: `Cron expression '${input.cron}' does not match any calendar date in the next year.`,
        errorCode: 2,
      }
    }
    const tasks = await listAllCronTasks()
    if (tasks.length >= MAX_JOBS) {
      return {
        result: false,
        message: `Too many scheduled jobs (max ${MAX_JOBS}). Cancel one first.`,
        errorCode: 3,
      }
    }
    // Teammates don't persist across sessions, so a durable teammate cron
    // would orphan on restart (agentId would point to a nonexistent teammate).
    if (input.durable && getTeammateContext()) {
      return {
        result: false,
        message:
          'durable crons are not supported for teammates (teammates do not persist across sessions)',
        errorCode: 4,
      }
    }
    // Proactive ticks: reject cron periods shorter than the minimum tick
    // interval (measured over the next few fires).
    if (
      proactiveModule?.isProactiveActive() &&
      input.prompt.startsWith(`<${TICK_TAG}>`)
    ) {
      const now = Date.now()
      const firstRun = nextCronRunMs(input.cron, now)
      if (firstRun !== null) {
        const configured = (
          getInitialSettings() as { minTickIntervalMinutes?: unknown }
        ).minTickIntervalMinutes
        const minMinutes =
          typeof configured === 'number'
            ? configured
            : DEFAULT_MIN_TICK_INTERVAL_MINUTES
        const minMs = minMinutes * 60_000
        let from = firstRun
        let shortestGap = Infinity
        for (let i = 0; i < 5; i++) {
          const next = nextCronRunMs(input.cron, from)
          if (next === null) break
          const gap = next - from
          if (gap < shortestGap) shortestGap = gap
          from = next
        }
        if (shortestGap < minMs) {
          return {
            result: false,
            message: `Cron period too short: fires every ${Math.round(shortestGap / 1000)}s, but the minimum tick interval is ${minMinutes} ${plural(minMinutes, 'minute')}. Use a cron expression with at least ${minMinutes} ${plural(minMinutes, 'minute')} between fires.`,
            errorCode: 5,
          }
        }
      }
    }
    return { result: true }
  },
  async call({ cron, prompt, recurring = true, durable = false }) {
    // Kill switch forces session-only; schema stays stable so the model sees
    // no validation errors when the gate flips mid-session.
    const effectiveDurable = durable && isDurableCronEnabled()
    // Proactive ticks: shift createdAt so the first fire lands no earlier
    // than the minimum tick interval.
    let createdAt: number | undefined
    if (proactiveModule?.isProactiveActive() && prompt.startsWith(`<${TICK_TAG}>`)) {
      const now = Date.now()
      const firstRun = nextCronRunMs(cron, now)
      if (firstRun !== null) {
        const configured = (
          getInitialSettings() as { minTickIntervalMinutes?: unknown }
        ).minTickIntervalMinutes
        const minMs =
          (typeof configured === 'number'
            ? configured
            : DEFAULT_MIN_TICK_INTERVAL_MINUTES) * 60_000
        if (firstRun - now < minMs) {
          const shifted = now + minMs - 1
          const shiftedRun = nextCronRunMs(cron, shifted)
          if (shiftedRun !== null && shiftedRun - firstRun < minMs + 60_000) {
            createdAt = shifted
          }
        }
      }
    }
    const id = await addCronTask(
      cron,
      prompt,
      recurring,
      effectiveDurable,
      getTeammateContext()?.agentId,
      createdAt,
    )
    // Enable the scheduler so the task fires in this session. The
    // useScheduledTasks hook polls this flag and will start watching
    // on the next tick. For durable: false tasks the file never changes
    // — check() reads the session store directly — but the enable flag
    // is still what starts the tick loop.
    setScheduledTasksEnabled(true)
    return {
      data: {
        id,
        humanSchedule: cronToHuman(cron),
        recurring,
        durable: effectiveDurable,
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const where = output.durable
      ? 'Persisted to .claude/scheduled_tasks.json'
      : 'Session-only (not written to disk, dies when Claude exits)'
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: output.recurring
        ? `Scheduled recurring job ${output.id} (${output.humanSchedule}). ${where}. Auto-expires after ${DEFAULT_MAX_AGE_DAYS} days. Use CronDelete to cancel sooner.`
        : `Scheduled one-shot task ${output.id} (${output.humanSchedule}). ${where}. It will fire once then auto-delete.`,
    }
  },
  renderToolUseMessage: renderCreateToolUseMessage,
  renderToolResultMessage: renderCreateResultMessage,
} satisfies ToolDef<InputSchema, CreateOutput>)
