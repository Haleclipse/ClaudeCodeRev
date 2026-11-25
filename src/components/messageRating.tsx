import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useNotifications } from '../context/notifications.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'

/**
 * Thumbs-up/down feedback on assistant messages. The provider owns the
 * ratings and which message / tool block the pointer is over; message
 * components read them through the hooks below and only show the rating
 * controls when the feature is on.
 */

export type MessageSentiment = 'positive' | 'negative'

export const RateMessageContext = createContext<
  ((messageUuid: string, sentiment: MessageSentiment) => void) | null
>(null)

const NO_RATINGS: ReadonlyMap<string, MessageSentiment> = new Map()
const MessageRatingsContext = createContext(NO_RATINGS)

export function useMessageRating(
  messageUuid: string | undefined,
): MessageSentiment | undefined {
  const ratings = useContext(MessageRatingsContext)
  return messageUuid ? ratings.get(messageUuid) : undefined
}

// Tool-use / tool-result blocks: the hovered block's tool_use id
const HoveredToolUseIdContext = createContext<string | null>(null)
const SetHoveredToolUseIdContext = createContext<
  ((toolUseId: string | null) => void) | null
>(null)

export function useHoveredToolUseId(): string | null {
  return useContext(HoveredToolUseIdContext)
}

export function useSetHoveredToolUseId():
  | ((toolUseId: string | null) => void)
  | null {
  return useContext(SetHoveredToolUseIdContext)
}

// Text messages: the hovered message's uuid (leaving is debounced)
const HoveredMessageContext = createContext<string | null>(null)
const SetHoveredMessageContext = createContext<
  ((messageUuid: string | null) => void) | null
>(null)

export function useHoveredMessage(): string | null {
  return useContext(HoveredMessageContext)
}

export function useSetHoveredMessage():
  | ((messageUuid: string | null) => void)
  | null {
  return useContext(SetHoveredMessageContext)
}

export function MessageRatingProvider({
  children,
}: {
  children: ReactNode
}): ReactNode {
  const [hoveredToolUseId, setHoveredToolUseId] = useState<string | null>(
    null,
  )
  const [hoveredMessage, setHoveredMessageNow] = useState<string | null>(null)
  const [ratings, setRatings] =
    useState<ReadonlyMap<string, MessageSentiment>>(NO_RATINGS)
  const ratingsRef = useRef(ratings)
  ratingsRef.current = ratings
  const { addNotification } = useNotifications()

  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    },
    [],
  )

  const setHoveredMessage = useCallback((messageUuid: string | null) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    if (messageUuid === null) {
      // Moving between a message and its rating arrows briefly leaves both;
      // keep the hover through that 150ms gap instead of flickering.
      leaveTimerRef.current = setTimeout(
        set => set(null),
        150,
        setHoveredMessageNow,
      )
    } else {
      setHoveredMessageNow(messageUuid)
    }
  }, [])

  const rateMessage = useCallback(
    (messageUuid: string, sentiment: MessageSentiment) => {
      if (ratingsRef.current.get(messageUuid) === sentiment) return
      setRatings(prev => {
        const next = new Map(prev)
        next.set(messageUuid, sentiment)
        return next
      })
      logEvent('tengu_message_rated', {
        message_uuid:
          messageUuid as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        sentiment:
          sentiment as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      addNotification({
        key: 'message-rated',
        text: 'thanks for improving claude!',
        color: 'success',
        priority: 'immediate',
      })
    },
    [addNotification],
  )

  return (
    <RateMessageContext.Provider value={rateMessage}>
      <MessageRatingsContext.Provider value={ratings}>
        <SetHoveredToolUseIdContext.Provider value={setHoveredToolUseId}>
          <HoveredToolUseIdContext.Provider value={hoveredToolUseId}>
            <SetHoveredMessageContext.Provider value={setHoveredMessage}>
              <HoveredMessageContext.Provider value={hoveredMessage}>
                {children}
              </HoveredMessageContext.Provider>
            </SetHoveredMessageContext.Provider>
          </HoveredToolUseIdContext.Provider>
        </SetHoveredToolUseIdContext.Provider>
      </MessageRatingsContext.Provider>
    </RateMessageContext.Provider>
  )
}
