import React from 'react'
import { TeleportResumeWrapper } from '../../components/TeleportResumeWrapper.js'
import type {
  LocalJSXCommandCall,
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'

export function Teleport({
  onExit,
  context,
}: {
  onExit: LocalJSXCommandOnDone
  context: LocalJSXCommandContext
}): React.ReactNode {
  return (
    <TeleportResumeWrapper
      onComplete={result => {
        context.setMessages(() => result.log)
        onExit('Session resumed successfully', { display: 'system' })
      }}
      onCancel={() => {
        onExit('Teleport cancelled', { display: 'system' })
      }}
      onError={(message, _formattedMessage) => {
        onExit(message, { display: 'system' })
      }}
      isEmbedded
      source="localCommand"
    />
  )
}

export const call: LocalJSXCommandCall = async (onDone, context) => {
  return <Teleport onExit={onDone} context={context} />
}
