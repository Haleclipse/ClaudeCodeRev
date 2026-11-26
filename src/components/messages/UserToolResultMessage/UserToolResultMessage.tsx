import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { feature } from 'bun:bundle'
import * as React from 'react'
import { useContext, useState } from 'react'
import { DOWN_ARROW } from '../../../constants/figures.js'
import { Box, NoSelect, Text } from '../../../ink.js'
import type { Tools } from '../../../Tool.js'
import type {
  NormalizedUserMessage,
  ProgressMessage,
} from '../../../types/message.js'
import { isFullscreenEnvEnabled } from '../../../utils/fullscreen.js'
import {
  type buildMessageLookups,
  CANCEL_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
  REJECT_MESSAGE,
} from '../../../utils/messages.js'
import {
  RateMessageContext,
  useHoveredToolUseId,
  useMessageRating,
  useSetHoveredToolUseId,
} from '../../messageRating.js'
import { UserToolCanceledMessage } from './UserToolCanceledMessage.js'
import { UserToolErrorMessage } from './UserToolErrorMessage.js'
import { UserToolRejectMessage } from './UserToolRejectMessage.js'
import { UserToolSuccessMessage } from './UserToolSuccessMessage.js'
import { useGetToolFromMessages } from './utils.js'

type Props = {
  param: ToolResultBlockParam
  message: NormalizedUserMessage
  lookups: ReturnType<typeof buildMessageLookups>
  progressMessagesForMessage: ProgressMessage[]
  style?: 'condensed'
  tools: Tools
  verbose: boolean
  width: number | string
  isTranscriptMode?: boolean
}

export function UserToolResultMessage({
  param,
  message,
  lookups,
  progressMessagesForMessage,
  style,
  tools,
  verbose,
  width,
  isTranscriptMode,
}: Props): React.ReactNode {
  const toolUse = useGetToolFromMessages(param.tool_use_id, tools, lookups)
  const setHoveredToolUseId = useSetHoveredToolUseId()
  const hoveredToolUseId = useHoveredToolUseId()
  const rateMessage = useContext(RateMessageContext)
  // Ratings attach to the assistant message that issued the tool_use
  const assistantUuid = lookups.assistantUuidByToolUseID.get(param.tool_use_id)
  const rating = useMessageRating(assistantUuid)
  const [arrowHovered, setArrowHovered] = useState(false)
  if (!toolUse) {
    return null
  }

  let content: React.ReactNode
  if (
    typeof param.content === 'string' &&
    param.content.startsWith(CANCEL_MESSAGE)
  ) {
    content = <UserToolCanceledMessage />
  } else if (
    (typeof param.content === 'string' &&
      param.content.startsWith(REJECT_MESSAGE)) ||
    param.content === INTERRUPT_MESSAGE_FOR_TOOL_USE
  ) {
    content = (
      <UserToolRejectMessage
        input={toolUse.toolUse.input as { [key: string]: unknown }}
        progressMessagesForMessage={progressMessagesForMessage}
        tool={toolUse.tool}
        tools={tools}
        lookups={lookups}
        style={style}
        verbose={verbose}
        isTranscriptMode={isTranscriptMode}
      />
    )
  } else if (param.is_error) {
    content = (
      <UserToolErrorMessage
        progressMessagesForMessage={progressMessagesForMessage}
        tool={toolUse.tool}
        tools={tools}
        param={param}
        verbose={verbose}
        isTranscriptMode={isTranscriptMode}
      />
    )
  } else {
    content = (
      <UserToolSuccessMessage
        message={message}
        lookups={lookups}
        toolUseID={toolUse.toolUse.id}
        progressMessagesForMessage={progressMessagesForMessage}
        style={style}
        tool={toolUse.tool}
        tools={tools}
        verbose={verbose}
        width={width}
        isTranscriptMode={isTranscriptMode}
      />
    )
  }

  // Hover state is shared with the AssistantToolUseMessage of the same
  // tool_use id, which shows ↑ in its dot column; ↓ goes under the result.
  const isHovered = hoveredToolUseId === param.tool_use_id
  return (
    <Box
      flexDirection="column"
      onMouseEnter={
        feature('MESSAGE_ACTIONS')
          ? () => setHoveredToolUseId?.(param.tool_use_id)
          : undefined
      }
      onMouseLeave={
        feature('MESSAGE_ACTIONS')
          ? () => setHoveredToolUseId?.(null)
          : undefined
      }
    >
      {content}
      {feature('MESSAGE_ACTIONS') &&
      isFullscreenEnvEnabled() &&
      assistantUuid &&
      rateMessage &&
      (isHovered || rating !== undefined) ? (
        <NoSelect
          fromLeftEdge
          onClick={() => rateMessage(assistantUuid, 'negative')}
          onMouseEnter={() => setArrowHovered(true)}
          onMouseLeave={() => setArrowHovered(false)}
        >
          <Text
            color={
              rating === 'negative' || arrowHovered ? 'error' : undefined
            }
            dimColor={rating !== 'negative' && !arrowHovered}
          >
            {DOWN_ARROW}
          </Text>
        </NoSelect>
      ) : null}
    </Box>
  )
}
