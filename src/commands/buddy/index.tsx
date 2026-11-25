import React from 'react'
import {
  companionUserId,
  getCompanion,
  type Roll,
  roll,
} from '../../buddy/companion.js'
import {
  getLastReaction,
  triggerHatchReaction,
  triggerPetReaction,
} from '../../buddy/observer.js'
import { generateCompanionSoul } from '../../buddy/soul.js'
import type { Companion } from '../../buddy/types.js'
import { isBuddyTeaserWindow } from '../../buddy/useBuddyNotification.js'
import type { Command } from '../../commands.js'
import type { AppState } from '../../state/AppState.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { CompanionCard } from './CompanionCard.js'
import { HatchingAnimation } from './HatchingAnimation.js'

// Generate the soul and persist it. Only the soul (name/personality) is
// stored; bones are re-rolled from the user id on every read.
async function hatchCompanion(
  rolled: Roll,
  signal?: AbortSignal,
): Promise<Companion> {
  const { bones, inspirationSeed } = rolled
  const soul = await generateCompanionSoul(bones, inspirationSeed, signal)
  const hatchedAt = Date.now()
  saveGlobalConfig(config => ({
    ...config,
    companion: { ...soul, hatchedAt },
  }))
  return { ...bones, ...soul, hatchedAt }
}

function setCompanionReaction(
  setAppState: (f: (prev: AppState) => AppState) => void,
): (reaction: string) => void {
  return reaction =>
    setAppState(prev =>
      prev.companionReaction === reaction
        ? prev
        : { ...prev, companionReaction: reaction },
    )
}

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch a coding companion · pet, off',
  isHidden: !isBuddyTeaserWindow(),
  immediate: true,
  load: () =>
    Promise.resolve({
      async call(onDone, context, args) {
        const config = getGlobalConfig()
        const arg = args?.trim()

        if (arg === 'pet') {
          const companion = getCompanion()
          if (!companion) {
            onDone('no companion yet · run /buddy first', {
              display: 'system',
            })
            return null
          }
          if (config.companionMuted === true) {
            saveGlobalConfig(c => ({ ...c, companionMuted: false }))
          }
          context.setAppState(prev => ({ ...prev, companionPetAt: Date.now() }))
          triggerPetReaction(setCompanionReaction(context.setAppState))
          onDone(`petted ${companion.name}`, { display: 'system' })
          return null
        }

        if (arg === 'off') {
          if (config.companionMuted !== true) {
            saveGlobalConfig(c => ({ ...c, companionMuted: true }))
          }
          onDone('companion muted', { display: 'system' })
          return null
        }

        if (arg === 'on') {
          if (config.companionMuted === true) {
            saveGlobalConfig(c => ({ ...c, companionMuted: false }))
          }
          onDone('companion unmuted', { display: 'system' })
          return null
        }

        // Plain /buddy also unmutes
        if (config.companionMuted === true) {
          saveGlobalConfig(c => ({ ...c, companionMuted: false }))
        }

        const companion = getCompanion()
        if (companion) {
          return (
            <CompanionCard
              companion={companion}
              lastReaction={getLastReaction()}
              onDone={onDone}
            />
          )
        }

        const hatching = hatchCompanion(roll(companionUserId()))
        hatching
          .then(hatched =>
            triggerHatchReaction(
              hatched,
              setCompanionReaction(context.setAppState),
            ),
          )
          .catch(() => {})
        return <HatchingAnimation hatching={hatching} onDone={onDone} />
      },
    }),
} satisfies Command

export default buddy
