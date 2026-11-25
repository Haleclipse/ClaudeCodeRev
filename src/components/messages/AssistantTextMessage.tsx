import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { feature } from 'bun:bundle'
import React, { useContext, useState } from 'react'
import { ERROR_MESSAGE_USER_ABORT } from 'src/services/compact/compact.js'
import { isRateLimitErrorMessage } from 'src/services/rateLimitMessages.js'
import {
  BLACK_CIRCLE,
  DOWN_ARROW,
  UP_ARROW,
} from '../../constants/figures.js'
import { Box, NoSelect, Text } from '../../ink.js'
import {
  API_ERROR_MESSAGE_PREFIX,
  API_TIMEOUT_ERROR_MESSAGE,
  CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE,
  CUSTOM_OFF_SWITCH_MESSAGE,
  INVALID_API_KEY_ERROR_MESSAGE,
  INVALID_API_KEY_ERROR_MESSAGE_EXTERNAL,
  ORG_DISABLED_ERROR_MESSAGE_ENV_KEY,
  ORG_DISABLED_ERROR_MESSAGE_ENV_KEY_WITH_OAUTH,
  PROMPT_TOO_LONG_ERROR_MESSAGE,
  startsWithApiErrorPrefix,
  TOKEN_REVOKED_ERROR_MESSAGE,
} from '../../services/api/errors.js'
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js'
import {
  isEmptyMessageText,
  NO_RESPONSE_REQUESTED,
} from '../../utils/messages.js'
import { getUpgradeMessage } from '../../utils/model/contextWindowUpgradeCheck.js'
import {
  getDefaultSonnetModel,
  renderModelName,
} from '../../utils/model/model.js'
import { isMacOsKeychainLocked } from '../../utils/secureStorage/macOsKeychainStorage.js'
import { CtrlOToExpand } from '../CtrlOToExpand.js'
import { InterruptedByUser } from '../InterruptedByUser.js'
import { Markdown } from '../Markdown.js'
import { MessageResponse } from '../MessageResponse.js'
import { MessageActionsSelectedContext } from '../messageActions.js'
import {
  RateMessageContext,
  useHoveredMessage,
  useMessageRating,
  useSetHoveredMessage,
} from '../messageRating.js'
import { RateLimitMessage } from './RateLimitMessage.js'

const MAX_API_ERROR_CHARS = 1000

type Props = {
  param: TextBlockParam
  addMargin: boolean
  shouldShowDot: boolean
  verbose: boolean
  width?: number | string
  onOpenRateLimitOptions?: () => void
  /** Assistant message uuid, for rating */
  messageUuid?: string
}

function InvalidApiKeyMessage(): React.ReactNode {
  const isKeychainLocked = isMacOsKeychainLocked()

  return (
    <MessageResponse>
      <Box flexDirection="column">
        <Text color="error">{INVALID_API_KEY_ERROR_MESSAGE}</Text>
        {isKeychainLocked && (
          <Text dimColor>
            · Run in another terminal: security unlock-keychain
          </Text>
        )}
      </Box>
    </MessageResponse>
  )
}

export function AssistantTextMessage({
  param: { text },
  addMargin,
  shouldShowDot,
  verbose,
  onOpenRateLimitOptions,
  messageUuid,
}: Props): React.ReactNode {
  const isSelected = useContext(MessageActionsSelectedContext)
  const rateMessage = useContext(RateMessageContext)
  const hoveredMessage = useHoveredMessage()
  const setHoveredMessage = useSetHoveredMessage()
  const isHovered = hoveredMessage === messageUuid
  const rating = useMessageRating(messageUuid)
  const [hoveredArrow, setHoveredArrow] = useState<'up' | 'down' | null>(
    null,
  )
  if (isEmptyMessageText(text)) {
    return null
  }

  // Handle all rate limit error messages from getRateLimitErrorMessage
  // Use the exported function to avoid fragile string coupling
  if (isRateLimitErrorMessage(text)) {
    return (
      <RateLimitMessage
        text={text}
        onOpenRateLimitOptions={onOpenRateLimitOptions}
      />
    )
  }

  switch (text) {
    // Local JSX commands don't need a response, but we still want Claude to see them
    // Tool results render their own interrupt messages
    case NO_RESPONSE_REQUESTED:
      return null

    case PROMPT_TOO_LONG_ERROR_MESSAGE: {
      const upgradeHint = getUpgradeMessage('warning')
      return (
        <MessageResponse height={1}>
          <Text color="error">
            Context limit reached · /compact or /clear to continue
            {upgradeHint ? ` · ${upgradeHint}` : ''}
          </Text>
        </MessageResponse>
      )
    }

    case CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE:
      return (
        <MessageResponse height={1}>
          <Text color="error">
            Credit balance too low &middot; Add funds:
            https://platform.claude.com/settings/billing
          </Text>
        </MessageResponse>
      )

    case INVALID_API_KEY_ERROR_MESSAGE:
      return <InvalidApiKeyMessage />

    case INVALID_API_KEY_ERROR_MESSAGE_EXTERNAL:
      return (
        <MessageResponse height={1}>
          <Text color="error">{INVALID_API_KEY_ERROR_MESSAGE_EXTERNAL}</Text>
        </MessageResponse>
      )

    case ORG_DISABLED_ERROR_MESSAGE_ENV_KEY:
    case ORG_DISABLED_ERROR_MESSAGE_ENV_KEY_WITH_OAUTH:
      return (
        <MessageResponse>
          <Text color="error">{text}</Text>
        </MessageResponse>
      )

    case TOKEN_REVOKED_ERROR_MESSAGE:
      return (
        <MessageResponse height={1}>
          <Text color="error">{TOKEN_REVOKED_ERROR_MESSAGE}</Text>
        </MessageResponse>
      )

    case API_TIMEOUT_ERROR_MESSAGE:
      return (
        <MessageResponse height={1}>
          <Text color="error">
            {API_TIMEOUT_ERROR_MESSAGE}
            {process.env.API_TIMEOUT_MS && (
              <>
                {' '}
                (API_TIMEOUT_MS={process.env.API_TIMEOUT_MS}ms, try increasing
                it)
              </>
            )}
          </Text>
        </MessageResponse>
      )

    case CUSTOM_OFF_SWITCH_MESSAGE:
      return (
        <MessageResponse>
          <Box flexDirection="column" gap={1}>
            <Text color="error">
              We are experiencing high demand for Opus 4.
            </Text>
            <Text>
              To continue immediately, use /model to switch to{' '}
              {renderModelName(getDefaultSonnetModel())} and continue coding.
            </Text>
          </Box>
        </MessageResponse>
      )

    // TODO: Move this to a user turn
    case ERROR_MESSAGE_USER_ABORT:
      return (
        <MessageResponse height={1}>
          <InterruptedByUser />
        </MessageResponse>
      )

    default: {
      if (startsWithApiErrorPrefix(text)) {
        const truncated = !verbose && text.length > MAX_API_ERROR_CHARS
        return (
          <MessageResponse>
            <Box flexDirection="column">
              <Text color="error">
                {text === API_ERROR_MESSAGE_PREFIX
                  ? `${API_ERROR_MESSAGE_PREFIX}: Please wait a moment and try again.`
                  : truncated
                    ? text.slice(0, MAX_API_ERROR_CHARS) + '…'
                    : text}
              </Text>
              {truncated && <CtrlOToExpand />}
            </Box>
          </MessageResponse>
        )
      }
      // Rating: hovering the message swaps the dot for ↑ and shows ↓ under
      // it (gated; inferred to share the MESSAGE_ACTIONS flag). Hover needs
      // mouse events, which only the fullscreen renderer delivers.
      const showRating = feature('MESSAGE_ACTIONS')
        ? isFullscreenEnvEnabled() &&
          messageUuid !== undefined &&
          rateMessage !== null &&
          shouldShowDot
        : false
      return (
        <Box
          alignItems="flex-start"
          flexDirection="row"
          justifyContent="space-between"
          marginTop={addMargin ? 1 : 0}
          minHeight={showRating ? 2 : undefined}
          width="100%"
          backgroundColor={isSelected ? 'messageActionsBackground' : undefined}
          onMouseEnter={
            showRating
              ? () => setHoveredMessage?.(messageUuid ?? null)
              : undefined
          }
          onMouseLeave={
            showRating ? () => setHoveredMessage?.(null) : undefined
          }
        >
          <Box flexDirection="row">
            {shouldShowDot &&
              ((isHovered || rating !== undefined) && showRating ? (
                <NoSelect
                  fromLeftEdge
                  minWidth={2}
                  onClick={() => rateMessage!(messageUuid!, 'positive')}
                  onMouseEnter={() => setHoveredArrow('up')}
                  onMouseLeave={() => setHoveredArrow(null)}
                >
                  <Text
                    color={
                      rating === 'positive' || hoveredArrow === 'up'
                        ? 'success'
                        : undefined
                    }
                    dimColor={rating !== 'positive' && hoveredArrow !== 'up'}
                  >
                    {UP_ARROW}
                  </Text>
                </NoSelect>
              ) : (
                <NoSelect fromLeftEdge minWidth={2}>
                  <Text color={isSelected ? 'suggestion' : 'text'}>
                    {BLACK_CIRCLE}
                  </Text>
                </NoSelect>
              ))}
            <Box flexDirection="column">
              <Markdown>{text}</Markdown>
            </Box>
          </Box>
          {(isHovered || rating !== undefined) && showRating && (
            <NoSelect
              fromLeftEdge
              position="absolute"
              top={1}
              left={0}
              opaque
              onClick={() => rateMessage!(messageUuid!, 'negative')}
              onMouseEnter={() => setHoveredArrow('down')}
              onMouseLeave={() => setHoveredArrow(null)}
            >
              <Text
                color={
                  rating === 'negative' || hoveredArrow === 'down'
                    ? 'error'
                    : undefined
                }
                dimColor={rating !== 'negative' && hoveredArrow !== 'down'}
              >
                {DOWN_ARROW}
              </Text>
            </NoSelect>
          )}
        </Box>
      )
    }
  }
}
