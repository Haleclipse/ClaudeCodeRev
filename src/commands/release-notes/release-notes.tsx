import React from 'react'
import { Select } from '../../components/CustomSelect/select.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { Box, Text } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  CHANGELOG_URL,
  fetchAndStoreChangelog,
  getAllReleaseNotes,
  getStoredChangelog,
} from '../../utils/releaseNotes.js'
import { gt } from '../../utils/semver.js'

const SHOW_ALL_VALUE = '__show_all__'

function formatReleaseNotes(version: string, notes: string[]): string {
  const header = `Version ${version}:`
  const bulletPoints = notes.map(note => `· ${note}`).join('\n')
  return `${header}\n${bulletPoints}`
}

function formatAllReleaseNotes(notes: Array<[string, string[]]>): string {
  return notes
    .slice()
    .sort(([a], [b]) => (gt(a, b) ? 1 : -1))
    .map(([version, items]) => formatReleaseNotes(version, items))
    .join('\n\n')
}

export async function call(
  onDone: LocalJSXCommandOnDone,
): Promise<React.ReactNode> {
  // Try to fetch the latest changelog with a 500ms timeout
  try {
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(rej => rej(new Error('Timeout')), 500, reject),
    )

    await Promise.race([fetchAndStoreChangelog(), timeoutPromise])
  } catch {
    // Either fetch failed or timed out - just use cached notes
  }

  const changelog = await getStoredChangelog()
  // Newest version first
  const notes = getAllReleaseNotes(changelog)
    .slice()
    .sort(([a], [b]) => (gt(a, b) ? -1 : 1))

  // Nothing available, show link
  if (notes.length === 0) {
    onDone(`See the full changelog at: ${CHANGELOG_URL}`, { display: 'system' })
    return null
  }

  return <ReleaseNotesPicker notes={notes} onDone={onDone} />
}

function ReleaseNotesPicker({
  notes,
  onDone,
}: {
  notes: Array<[string, string[]]>
  onDone: LocalJSXCommandOnDone
}): React.ReactNode {
  const options = [
    {
      label: 'Show all',
      description: `${notes.length} versions`,
      value: SHOW_ALL_VALUE,
    },
    ...notes.map(([version, items]) => ({
      label: `Version ${version}`,
      description: `${items.length} ${items.length === 1 ? 'item' : 'items'}`,
      value: version,
    })),
  ]

  function handleChange(value: string): void {
    if (value === SHOW_ALL_VALUE) {
      onDone(formatAllReleaseNotes(notes), { display: 'system' })
      return
    }
    const entry = notes.find(([version]) => version === value)
    if (!entry) {
      onDone(undefined, { display: 'skip' })
      return
    }
    onDone(formatReleaseNotes(entry[0], entry[1]), { display: 'system' })
  }

  return (
    <Dialog
      title="Release notes"
      onCancel={() => onDone(undefined, { display: 'skip' })}
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Select a version to view its notes.</Text>
      </Box>
      <Select
        options={options}
        visibleOptionCount={10}
        onChange={handleChange}
        onCancel={() => onDone(undefined, { display: 'skip' })}
      />
    </Dialog>
  )
}
