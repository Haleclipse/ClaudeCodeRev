import figures from 'figures'
import * as React from 'react'
import { useState } from 'react'
import { Box, Text } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { Select } from '../CustomSelect/select.js'
import { Pane } from '../design-system/Pane.js'
import { ProgressBar } from '../design-system/ProgressBar.js'
import { StatusIcon } from '../design-system/StatusIcon.js'
import { Confetti, ShimmerText } from './demos.js'
import {
  type Lesson,
  LESSONS,
  LessonFooter,
  LessonListFooter,
} from './lessons.js'

type Props = {
  onExit: (result?: string) => void
}

/**
 * /powerup: a list of short interactive lessons. Marking a lesson done unlocks
 * it (persisted in global config `powerupsUnlocked`); unlocking the last one
 * plays a confetti burst.
 */
export function Powerup({ onExit }: Props): React.ReactNode {
  const [unlocked, setUnlocked] = useState(loadUnlockedLessons)
  const [viewing, setViewing] = useState<Lesson | null>(null)
  const [focusedId, setFocusedId] = useState(LESSONS[0]!.id)
  const [celebrating, setCelebrating] = useState(false)
  const stopCelebrating = () => setCelebrating(false)

  function openLesson(lesson: Lesson) {
    setFocusedId(lesson.id)
    setViewing(lesson)
    logEvent('tengu_powerup_lesson_opened', {
      lesson_id:
        lesson.id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      was_already_unlocked: unlocked.has(lesson.id),
      unlocked_count: unlocked.size,
    })
  }

  function markDone(id: string) {
    if (unlocked.has(id)) return
    const next = new Set(unlocked).add(id)
    setUnlocked(next)
    saveGlobalConfig(current => ({
      ...current,
      powerupsUnlocked: [...next],
    }))
    logEvent('tengu_powerup_lesson_completed', {
      lesson_id:
        id as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      unlocked_count: next.size,
      all_unlocked: next.size === LESSONS.length,
    })
    if (next.size === LESSONS.length) setCelebrating(true)
  }

  const options = LESSONS.map(lesson => {
    const done = unlocked.has(lesson.id)
    const label = `${done ? figures.tick : figures.circle} ${lesson.title}`
    return {
      label: done ? <Text color="success">{label}</Text> : label,
      value: lesson.id,
      description: lesson.tagline,
    }
  })

  if (viewing) {
    return (
      <LessonView
        lesson={viewing}
        isUnlocked={unlocked.has(viewing.id)}
        onDone={() => {
          markDone(viewing.id)
          setViewing(null)
        }}
        onBack={() => setViewing(null)}
      />
    )
  }

  const allUnlocked = unlocked.size === LESSONS.length
  return (
    <Pane color="claude">
      <Box flexDirection="column">
        <Box marginBottom={1}>
          {allUnlocked ? (
            <ShimmerText text="All powered up" />
          ) : (
            <Text bold color="claude">
              Power-ups
            </Text>
          )}
          <Text dimColor>
            {' '}
            {unlocked.size}/{LESSONS.length} unlocked{' '}
          </Text>
          <ProgressBar
            ratio={unlocked.size / LESSONS.length}
            width={16}
            fillColor="claude"
            emptyColor="inactive"
          />
        </Box>
        <Box marginBottom={1}>
          <Text dimColor wrap="wrap">
            {allUnlocked
              ? 'Now go build something.'
              : 'Each power-up teaches one thing Claude Code can do that most people miss. Open one, read it, try it, mark it done.'}
          </Text>
        </Box>
        <Select
          options={options}
          hideIndexes
          visibleOptionCount={LESSONS.length}
          defaultFocusValue={focusedId}
          onChange={id => {
            const lesson = LESSONS.find(l => l.id === id)
            if (lesson) openLesson(lesson)
          }}
          onCancel={() => onExit('Power-ups closed')}
        />
        <Box marginTop={1}>
          <LessonListFooter />
        </Box>
        {celebrating && <Confetti onDone={stopCelebrating} />}
      </Box>
    </Pane>
  )
}

function loadUnlockedLessons(): Set<string> {
  const ids = getGlobalConfig().powerupsUnlocked ?? []
  return new Set(ids.filter(isKnownLesson))
}

function isKnownLesson(id: string): boolean {
  return LESSONS.some(lesson => lesson.id === id)
}

function LessonView({
  lesson,
  isUnlocked,
  onDone,
  onBack,
}: {
  lesson: Lesson
  isUnlocked: boolean
  onDone: () => void
  onBack: () => void
}): React.ReactNode {
  useKeybindings(
    { 'confirm:yes': onDone, 'confirm:no': onBack },
    { context: 'Confirmation' },
  )
  return (
    <Pane color="claude">
      <Box flexDirection="column" gap={1}>
        <Box>
          <StatusIcon status={isUnlocked ? 'success' : 'pending'} withSpace />
          <Text bold color="claude">
            {lesson.title}
          </Text>
        </Box>
        {lesson.body}
        <LessonFooter />
      </Box>
    </Pane>
  )
}
