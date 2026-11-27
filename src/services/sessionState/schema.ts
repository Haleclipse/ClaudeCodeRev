import { z } from 'zod/v4'
import { lazySchema } from '../../utils/lazySchema.js'

/**
 * Persisted session state record. `needs_you` is folded into `tempo`
 * (blocked / idle) when `tempo` is absent.
 */
export const sessionStateRecordSchema = lazySchema(() =>
  z
    .object({
      state: z.string(),
      detail: z.string(),
      tempo: z.enum(['active', 'idle', 'blocked']).optional(),
      needs_you: z.boolean().optional(),
      needs: z.string().optional(),
      output: z.record(z.string(), z.string()).nullable().default(null),
      headlineField: z.string().nullable().default(null),
      template: z.string(),
      intent: z.string(),
      name: z.string().optional(),
      sessionId: z.string(),
      cwd: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
      firstTerminalAt: z.string().nullable().default(null),
      worktreePath: z.string().optional(),
      worktreeBranch: z.string().optional(),
      worktreeHookBased: z.boolean().optional(),
      originCwd: z.string().optional(),
    })
    .transform(({ needs_you, ...rest }) => ({
      ...rest,
      tempo: rest.tempo ?? (needs_you ? 'blocked' : 'idle'),
    })),
)
