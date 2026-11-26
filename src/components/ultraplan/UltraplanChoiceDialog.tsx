import figures from 'figures'
import { stat, writeFile } from 'fs/promises'
import { join } from 'path'
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { UUID } from 'crypto'
import { getSessionId } from '../../bootstrap/state.js'
import { clearConversation } from '../../commands/clear/conversation.js'
import { useRegisterOverlay } from '../../context/overlayContext.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'
import { Box, Text, useInput, wrapText } from '../../ink.js'
import { useSetAppState } from '../../state/AppState.js'
import type { AppState } from '../../state/AppStateStore.js'
import type { RemoteAgentTaskState } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js'
import type { Message } from '../../types/message.js'
import { getDisplayPath } from '../../utils/file.js'
import type { FileStateCache } from '../../utils/fileStateCache.js'
import {
  enqueue,
  enqueuePendingNotification,
} from '../../utils/messageQueueManager.js'
import { createSystemMessage } from '../../utils/messages.js'
import { getPlansDirectory } from '../../utils/plans.js'
import { getTranscriptPath } from '../../utils/sessionStorage.js'
import { updateTaskState } from '../../utils/task/framework.js'
import { archiveRemoteSession } from '../../utils/teleport.js'
import { generateWordSlug } from '../../utils/words.js'
import { Select } from '../CustomSelect/select.js'
import { Dialog } from '../design-system/Dialog.js'

// Plan preview height: half the terminal rows minus PREVIEW_CHROME_ROWS,
// capped at MAX_PREVIEW_LINES.
const MAX_PREVIEW_LINES = 24
const PREVIEW_CHROME_ROWS = 11

type Choice = 'here' | 'fresh' | 'cancel'

type Props = {
  plan: string
  sessionId: string
  taskId: string
  setMessages: (updater: (prev: Message[]) => Message[]) => void
  readFileState: FileStateCache
  getAppState: () => AppState
  setConversationId: (id: UUID) => void
}

/**
 * Shown after the plan is approved in the browser (teleport path). Owns the
 * cleanup the poll deferred: completes the task, clears the pending choice
 * and session URL, and archives the remote session.
 */
export function UltraplanChoiceDialog({
  plan,
  sessionId,
  taskId,
  setMessages,
  readFileState,
  getAppState,
  setConversationId,
}: Props): React.ReactNode {
  useRegisterOverlay('ultraplan-choice')
  const setAppState = useSetAppState()

  async function handleChoice(choice: Choice): Promise<void> {
    switch (choice) {
      case 'here': {
        enqueuePendingNotification({
          value: [
            'Ultraplan approved in browser. Here is the plan:',
            '',
            '<ultraplan>',
            plan,
            '</ultraplan>',
            '',
            'The user approved this plan in the remote session. Give them a brief summary, then start implementing.',
          ].join('\n'),
          mode: 'task-notification',
        })
        break
      }
      case 'fresh': {
        const previousSessionId = getSessionId()
        // Suggest --resume only if the old session has a transcript on disk
        const hadTranscript = await stat(getTranscriptPath()).then(
          () => true,
          () => false,
        )
        await clearConversation({
          setMessages,
          readFileState,
          getAppState,
          setAppState,
          setConversationId,
        })
        if (hadTranscript) {
          setMessages(prev => [
            ...prev,
            createSystemMessage(
              `Previous session saved · resume with: claude --resume ${previousSessionId}`,
              'suggestion',
            ),
          ])
        }
        enqueue({
          value: `Here is the approved implementation plan:\n\n${plan}\n\nImplement this plan.`,
          mode: 'prompt',
        })
        break
      }
      case 'cancel': {
        const planPath = join(
          getPlansDirectory(),
          `${generateWordSlug()}-ultraplan.md`,
        )
        await writeFile(planPath, plan, { encoding: 'utf-8' })
        setMessages(prev => [
          ...prev,
          createSystemMessage(
            `Ultraplan rejected · Plan saved to ${getDisplayPath(planPath)}`,
            'suggestion',
          ),
        ])
      }
    }
    updateTaskState<RemoteAgentTaskState>(taskId, setAppState, t =>
      t.status !== 'running'
        ? t
        : { ...t, status: 'completed', endTime: Date.now() },
    )
    setAppState(prev =>
      prev.ultraplanPendingChoice
        ? {
            ...prev,
            ultraplanPendingChoice: undefined,
            ultraplanSessionUrl: undefined,
          }
        : prev,
    )
    void archiveRemoteSession(sessionId)
  }

  const { rows, columns } = useTerminalSize()
  const visibleHeight = Math.min(
    MAX_PREVIEW_LINES,
    Math.max(1, Math.floor(rows / 2) - PREVIEW_CHROME_ROWS),
  )
  const lines = useMemo(
    () => wrapText(plan, Math.max(1, columns - 4), 'wrap').split('\n'),
    [plan, columns],
  )
  const maxOffset = Math.max(0, lines.length - visibleHeight)
  const [scrollOffset, setScrollOffset] = useState(0)
  // Keep the offset in range when a resize shrinks the content
  useEffect(
    () => setScrollOffset(offset => Math.min(offset, maxOffset)),
    [maxOffset],
  )

  const isScrollable = lines.length > visibleHeight
  // REPL's ScrollKeybindingHandler is inactive while this dialog is focused,
  // so wheel and ctrl+u/ctrl+d scroll the preview here.
  useInput((input, key) => {
    if (!isScrollable) return
    const halfPage = Math.max(1, Math.floor(visibleHeight / 2))
    if ((key.ctrl && input === 'd') || key.wheelDown) {
      const step = key.wheelDown ? 3 : halfPage
      setScrollOffset(offset => Math.min(offset + step, maxOffset))
    } else if ((key.ctrl && input === 'u') || key.wheelUp) {
      const step = key.wheelUp ? 3 : halfPage
      setScrollOffset(offset => Math.max(offset - step, 0))
    }
  })

  const visibleText = lines
    .slice(scrollOffset, scrollOffset + visibleHeight)
    .join('\n')
  const canScrollUp = scrollOffset > 0
  const canScrollDown = scrollOffset < maxOffset

  return (
    <Dialog
      title="Ultraplan approved"
      subtitle="How should the plan be implemented?"
      onCancel={() => {}}
      isCancelActive={false}
      hideInputGuide
    >
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="column" marginBottom={1}>
          <Text>{visibleText}</Text>
          {isScrollable && (
            <Text dimColor>
              {canScrollUp ? figures.arrowUp : ' '}
              {canScrollDown ? figures.arrowDown : ' '} {scrollOffset + 1}–
              {Math.min(scrollOffset + visibleHeight, lines.length)} of{' '}
              {lines.length} · ctrl+u/ctrl+d to scroll
            </Text>
          )}
        </Box>
        <Select
          options={[
            {
              label: 'Implement here',
              value: 'here' as const,
              description: 'Inject plan into the current conversation',
            },
            {
              label: 'Start new session',
              value: 'fresh' as const,
              description: 'Clear conversation and start with only the plan',
            },
            {
              label: 'Cancel',
              value: 'cancel' as const,
              description: "Don't implement — save plan and return",
            },
          ]}
          onChange={v => void handleChoice(v)}
        />
      </Box>
    </Dialog>
  )
}
