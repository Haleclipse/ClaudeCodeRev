import React, { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Box, Text } from '../../ink.js'
import { count } from '../../utils/array.js'
import { findFirstMatch } from '../../utils/model/bedrock.js'
import { plural } from '../../utils/stringUtils.js'
import { Select } from '../CustomSelect/select.js'
import { StatusIcon } from '../design-system/StatusIcon.js'
import { Spinner } from '../Spinner.js'
import { useWizard } from '../wizard/index.js'
import { WizardDialogLayout } from '../wizard/WizardDialogLayout.js'
import type { BedrockWizardData } from './steps.js'
import {
  getDefaultModelsForRegion,
  type ModelTestFailure,
  type ModelTestResult,
  testModel,
} from './verify.js'

type Tier = 'sonnet' | 'opus' | 'haiku'
type TestState = 'pending' | ModelTestResult

const TIERS: Tier[] = ['sonnet', 'opus', 'haiku']

const TIER_LABELS: Record<Tier, string> = {
  sonnet: 'Sonnet',
  opus: 'Opus',
  haiku: 'Haiku',
}

const FAILURE_LABELS: Record<ModelTestFailure, string> = {
  auth: 'auth failed',
  permission: 'no InvokeModel permission',
  model: 'not enabled in this account',
  network: 'unreachable',
  other: 'request failed',
}

export function PinModelsStep(): ReactNode {
  const { goBack, goNext, updateWizardData, wizardData } =
    useWizard<BedrockWizardData>()
  const profiles = wizardData.discoveredProfiles ?? []
  const defaults = useMemo(
    () => getDefaultModelsForRegion(wizardData.region),
    [wizardData.region],
  )
  const initialPicks = (): Record<Tier, string> => ({
    sonnet:
      findFirstMatch(profiles, defaults.sonnet.needle) ??
      defaults.sonnet.fallback,
    opus:
      findFirstMatch(profiles, defaults.opus.needle) ?? defaults.opus.fallback,
    haiku:
      findFirstMatch(profiles, defaults.haiku.needle) ??
      defaults.haiku.fallback,
  })
  const [picks, setPicks] = useState(initialPicks)
  const [results, setResults] = useState<Record<Tier, TestState>>({
    sonnet: 'pending',
    opus: 'pending',
    haiku: 'pending',
  })
  const [view, setView] = useState<'summary' | { picking: Tier }>('summary')

  useEffect(() => {
    let cancelled = false
    setResults(prev => ({ ...prev, sonnet: 'pending' }))
    void testModel(wizardData, picks.sonnet).then(result => {
      if (!cancelled) setResults(prev => ({ ...prev, sonnet: result }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.sonnet])

  useEffect(() => {
    let cancelled = false
    setResults(prev => ({ ...prev, opus: 'pending' }))
    void testModel(wizardData, picks.opus).then(result => {
      if (!cancelled) setResults(prev => ({ ...prev, opus: result }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.opus])

  useEffect(() => {
    let cancelled = false
    setResults(prev => ({ ...prev, haiku: 'pending' }))
    void testModel(wizardData, picks.haiku).then(result => {
      if (!cancelled) setResults(prev => ({ ...prev, haiku: result }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks.haiku])

  if (view !== 'summary') {
    const tier = view.picking
    return (
      <TierModelPicker
        tier={tier}
        wizardData={wizardData}
        profiles={profiles}
        fallback={defaults[tier].fallback}
        current={picks[tier]}
        onPick={modelId => {
          setPicks(prev => ({ ...prev, [tier]: modelId }))
          const index = TIERS.indexOf(tier)
          const nextTier = TIERS[index + 1]
          setView(nextTier ? { picking: nextTier } : 'summary')
        }}
        onCancel={() => setView('summary')}
      />
    )
  }

  const canPin =
    TIERS.every(tier => results[tier] !== 'pending') &&
    TIERS.some(
      tier =>
        results[tier] !== 'pending' && (results[tier] as ModelTestResult).ok,
    )

  const handleChange = (value: string): void => {
    if (value === 'manual') {
      setView({ picking: 'sonnet' })
      return
    }
    if (value === 'pin') {
      const pinned = (tier: Tier): string | undefined => {
        const result = results[tier]
        return result !== 'pending' && result.ok ? picks[tier] : undefined
      }
      updateWizardData({
        pinSonnet: pinned('sonnet'),
        pinOpus: pinned('opus'),
        pinHaiku: pinned('haiku'),
      })
    } else
      updateWizardData({
        pinSonnet: undefined,
        pinOpus: undefined,
        pinHaiku: undefined,
      })
    goNext()
  }

  return (
    <WizardDialogLayout subtitle="Pin model versions">
      <Box flexDirection="column" gap={1}>
        <Text>
          Without pinning, Claude Code uses its built-in defaults. When a new
          model ships, your install will try to call it even if your account
          has not yet enabled it — Claude Code will fail to connect to Bedrock
          until you enable the model or pin to one you have.
        </Text>
        <Box flexDirection="column">
          <Text dimColor>Each candidate is tested with a one-token request:</Text>
          {TIERS.map(tier => (
            <TierStatusRow
              key={tier}
              label={TIER_LABELS[tier]}
              modelId={picks[tier]}
              state={results[tier]}
            />
          ))}
        </Box>
        <Select
          options={[
            ...(canPin
              ? [{ label: 'Pin the working models', value: 'pin' }]
              : []),
            { label: 'Choose different models…', value: 'manual' },
            {
              label: 'Skip — use Claude Code defaults (auto-updates)',
              value: 'skip',
            },
          ]}
          onChange={handleChange}
          onCancel={goBack}
        />
      </Box>
    </WizardDialogLayout>
  )
}

function TierModelPicker({
  tier,
  wizardData,
  profiles,
  fallback,
  current,
  onPick,
  onCancel,
}: {
  tier: Tier
  wizardData: BedrockWizardData
  profiles: string[]
  fallback: string
  current: string
  onPick: (modelId: string) => void
  onCancel: () => void
}): ReactNode {
  const candidates = useMemo(() => {
    const list = [
      ...profiles
        .filter(id => id.toLowerCase().includes(tier))
        .sort()
        .reverse(),
    ]
    if (!list.includes(fallback)) list.push(fallback)
    if (!list.includes(current)) list.push(current)
    return list
  }, [profiles, tier, fallback, current])
  const [results, setResults] = useState<Record<string, TestState>>(() =>
    Object.fromEntries(candidates.map(id => [id, 'pending'])),
  )

  useEffect(() => {
    let cancelled = false
    for (const id of candidates)
      void testModel(wizardData, id).then(result => {
        if (!cancelled) setResults(prev => ({ ...prev, [id]: result }))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const settled = candidates.every(id => results[id] !== 'pending')
  const isWorking = (id: string): boolean => {
    const result = results[id]
    return result !== undefined && result !== 'pending' && result.ok
  }
  const ordered = useMemo(() => {
    if (!settled) return candidates
    return [...candidates].sort(
      (a, b) => (isWorking(a) ? 0 : 1) - (isWorking(b) ? 0 : 1),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, results, settled])
  const options = ordered.map(id => ({
    value: id,
    label: (
      <CandidateLabel
        id={id}
        state={results[id] ?? 'pending'}
        suffix={
          id === fallback
            ? '(built-in default)'
            : id === current
              ? '(current)'
              : undefined
        }
      />
    ),
  }))
  const tierProfileCount = count(profiles, id =>
    id.toLowerCase().includes(tier),
  )

  return (
    <WizardDialogLayout subtitle={`Pin ${TIER_LABELS[tier]} model`}>
      <Box flexDirection="column" gap={1}>
        <Text dimColor>
          {tierProfileCount > 0
            ? `${tierProfileCount} ${TIER_LABELS[tier]} ${plural(tierProfileCount, 'profile')} in your account · each tested with a one-token request.`
            : `No ${TIER_LABELS[tier]} profiles found in your account.`}
        </Text>
        <Select
          key={settled ? 'settled' : 'pending'}
          options={options}
          defaultValue={settled ? ordered.find(isWorking) : current}
          onChange={onPick}
          onCancel={onCancel}
        />
      </Box>
    </WizardDialogLayout>
  )
}

function CandidateLabel({
  id,
  state,
  suffix,
}: {
  id: string
  state: TestState
  suffix?: string
}): ReactNode {
  if (state === 'pending') {
    return (
      <Text>
        <StatusIcon status="pending" withSpace />
        {id}
        {suffix && <Text dimColor> {suffix}</Text>}
      </Text>
    )
  }
  if (state.ok) {
    return (
      <Text>
        <StatusIcon status="success" withSpace />
        {id}
        {suffix && <Text dimColor> {suffix}</Text>}
      </Text>
    )
  }
  return (
    <Text dimColor>
      <StatusIcon status="error" withSpace />
      {id}
      {suffix && ` ${suffix}`} <Text color="error">({FAILURE_LABELS[state.reason]})</Text>
    </Text>
  )
}

function TierStatusRow({
  label,
  modelId,
  state,
}: {
  label: string
  modelId: string
  state: TestState
}): ReactNode {
  if (state === 'pending') {
    return (
      <Box>
        <Text>{'  '}</Text>
        <Spinner />
        <Text>
          {' '}
          {label.padEnd(7)}→ {modelId}
        </Text>
      </Box>
    )
  }
  if (state.ok) {
    return (
      <Text>
        {'  '}
        <StatusIcon status="success" withSpace />
        {label.padEnd(7)}→ <Text color="success">{modelId}</Text>
      </Text>
    )
  }
  return (
    <Text>
      {'  '}
      <StatusIcon status="error" withSpace />
      {label.padEnd(7)}→ <Text dimColor>{modelId}</Text>{' '}
      <Text color="error">({FAILURE_LABELS[state.reason]})</Text>
    </Text>
  )
}
