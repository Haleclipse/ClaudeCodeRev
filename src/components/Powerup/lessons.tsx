import * as React from 'react'
import { Box, Text } from '../../ink.js'
import { Byline } from '../design-system/Byline.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'
import { FrameDemo, ModeCycleDemo } from './demos.js'

/** One /powerup lesson: a feature most people miss, a short explanation, a demo. */
export type Lesson = {
  id: string
  title: string
  tagline: string
  body: React.ReactNode
}

function Key({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <Text bold color="claude">
      {children}
    </Text>
  )
}

function Cmd({ children }: { children: React.ReactNode }): React.ReactNode {
  return <Text color="suggestion">{children}</Text>
}

export function LessonListFooter(): React.ReactNode {
  return (
    <Text dimColor italic>
      <Byline>
        <KeyboardShortcutHint
          chord={['up', 'down']}
          format={{ arrowSep: '' }}
          action="select"
        />
        <KeyboardShortcutHint chord="enter" action="open" />
        <KeyboardShortcutHint chord="escape" action="close" />
      </Byline>
    </Text>
  )
}

export function LessonFooter(): React.ReactNode {
  return (
    <Text dimColor italic>
      <Byline>
        <KeyboardShortcutHint chord="enter" action="mark done" />
        <KeyboardShortcutHint chord="escape" action="back" />
      </Byline>
    </Text>
  )
}

export const LESSONS: Lesson[] = [
  {
    id: 'at-mentions',
    title: 'Talk to your codebase',
    tagline: '@ files, line refs',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Type <Key>@</Key> anywhere in your prompt to fuzzy-find and attach a file. Claude reads it before answering — no more pasting code.
        </Text>
        <FrameDemo
          frames={[
            '> what does [suggestion:@]\n#type a file name…',
            '> what does [suggestion:@src/auth.ts]\n  [suggestion:❯ src/auth.ts]\n#   src/auth.test.ts',
            '> what does [suggestion:@src/auth.ts] do?\n#◐ Reading src/auth.ts…',
            '> what does [suggestion:@src/auth.ts] do?\nExports validateToken() which\nchecks JWT expiry and signature.',
          ]}
        />
        <Text>
          Reference specific lines with <Cmd>src/app.ts:42</Cmd> and Claude jumps straight there. Works in both directions: Claude cites files the same way, so you can click to open them in your editor.
        </Text>
        <Text dimColor>
          Also try: <Cmd>@folder/</Cmd> to attach a whole directory tree.
        </Text>
      </Box>
    ),
  },
  {
    id: 'modes',
    title: 'Steer with modes',
    tagline: 'shift+tab, plan, auto',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Press <Key>shift+tab</Key> to cycle permission modes. Each mode changes how much Claude asks before acting:
        </Text>
        <ModeCycleDemo />
        <Box flexDirection="column" paddingLeft={2}>
          <Text>
            <Text color="success">default</Text> — ask before every edit
          </Text>
          <Text>
            <Text color="autoAccept">accept edits</Text> — edit freely, ask for commands
          </Text>
          <Text>
            <Text color="planMode">plan</Text> — research and propose, never touch files
          </Text>
          <Text>
            <Text color="warning">auto</Text> — Claude decides what is safe
          </Text>
        </Box>
        <Text dimColor>
          Use <Text color="planMode">plan</Text> for big refactors you want to review first. Use <Text color="warning">auto</Text> for long unattended tasks. Run <Cmd>/permissions</Cmd> to pre-allow specific commands so Claude stops asking about them.
        </Text>
      </Box>
    ),
  },
  {
    id: 'undo',
    title: 'Undo anything',
    tagline: '/rewind, Esc-Esc',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Claude checkpoints your files before every edit. Press{' '}
          <Key>Esc Esc</Key> (double-tap) to open <Cmd>/rewind</Cmd> and roll back to any prior state — code, conversation, or both.
        </Text>
        <FrameDemo
          frames={[
            '[success:✓] Updated regex in parser.ts\n#[error:8 tests failing]',
            '#press Esc Esc\nRewind to:\n  [suggestion:❯ before parser.ts edit]',
            '#[success:✓] parser.ts restored\n> try a simpler approach\n#◐ thinking…',
          ]}
        />
        <Text>
          Went down the wrong path? Rewind to before the detour and try a different prompt. Your git history stays clean.
        </Text>
        <Text dimColor>
          Also: <Cmd>/clear</Cmd> wipes conversation but keeps files.{' '}
          <Cmd>/branch</Cmd> forks the conversation to try two approaches.
        </Text>
      </Box>
    ),
  },
  {
    id: 'background',
    title: 'Run in the background',
    tagline: 'tasks, /tasks',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Long builds and test suites do not have to block you. Add{' '}
          <Key>&amp;</Key> to any bash command and it runs in the background — you keep chatting, Claude notifies you when it finishes.
        </Text>
        <FrameDemo
          frames={[
            '> run the test suite [claude:&]\n#task started in background',
            '> now fix the lint in app.ts\n#◐ Editing app.ts…\n#[warning:◐] bun test · 12s',
            '> now fix the lint in app.ts\n[success:✓] Removed unused import\n#[warning:◐] bun test · 28s',
            '> now fix the lint in app.ts\n[success:✓] Removed unused import\n#[success:✓] bun test · 284 pass',
          ]}
        />
        <Text>
          Run <Cmd>/tasks</Cmd> to see everything in flight. Claude can read task output mid-run and react to failures automatically.
        </Text>
        <Text dimColor>
          Subagents and workflows also run as tasks — it is all one queue.
        </Text>
      </Box>
    ),
  },
  {
    id: 'memory',
    title: 'Teach Claude your rules',
    tagline: 'CLAUDE.md, /memory',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Drop a <Cmd>CLAUDE.md</Cmd> file in your repo and Claude reads it at the start of every session. Put your conventions there: test commands, style rules, do-not-touch directories.
        </Text>
        <FrameDemo
          frames={[
            '#─ CLAUDE.md ─\n#Run tests with: [suggestion:bun test]\n#Never edit src/legacy/',
            '> add tests for the cache\n#◐ reading CLAUDE.md…',
            '> add tests for the cache\nWriting cache.test.ts,\nrunning [suggestion:bun test] to verify.',
          ]}
        />
        <Text>
          Run <Cmd>/init</Cmd> to generate a starter CLAUDE.md from your codebase. Run <Cmd>/memory</Cmd> to edit it inline.
        </Text>
        <Text dimColor>
          Works at three levels: repo, your home directory (all projects), and per-directory overrides.
        </Text>
      </Box>
    ),
  },
  {
    id: 'mcp',
    title: 'Extend with tools',
    tagline: 'MCP, /mcp',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          MCP servers give Claude new tools: read your Slack, query your database, control your browser. Run <Cmd>/mcp</Cmd> to browse and connect servers.
        </Text>
        <FrameDemo
          frames={[
            '> [suggestion:/mcp]\nConnected servers:\n  [success:✓] slack    [success:✓] github',
            '> anything urgent in #eng?\n#◐ [suggestion:slack] · reading channel…',
            'Boris posted about the merge\nfreeze. Also 3 PRs await\nyour review on github.',
          ]}
        />
        <Text>
          Once connected, tools appear automatically — ask Claude to "check my calendar" or "search our Notion" and it just works.
        </Text>
        <Text dimColor>
          From your shell:{' '}
          <Cmd>claude mcp add my-server -- npx some-mcp-pkg</Cmd> to wire one up without leaving the terminal.
        </Text>
      </Box>
    ),
  },
  {
    id: 'automate',
    title: 'Automate your workflow',
    tagline: 'skills, hooks',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Save a prompt to <Cmd>.claude/skills/deploy/SKILL.md</Cmd> and it becomes <Cmd>/deploy</Cmd> — type it, Claude runs it. Run{' '}
          <Cmd>/skills</Cmd> to see what you have.
        </Text>
        <FrameDemo
          frames={[
            '> [suggestion:/deploy] staging\n#◐ skill: deploy',
            '[success:✓] built\n[success:✓] tests pass\n#◐ pushing to staging…',
            '[success:✓] deployed\n#[suggestion:staging.app.com]\n#PostToolUse hook ran prettier',
          ]}
        />
        <Text>
          Hooks run your own scripts on events: before a tool call, after a response, on session start. Use them to enforce rules, log activity, or inject context. Run <Cmd>/hooks</Cmd> to see what fires when.
        </Text>
        <Text dimColor>
          Run <Cmd>/install-github-app</Cmd> to let Claude review PRs when tagged.
        </Text>
      </Box>
    ),
  },
  {
    id: 'subagents',
    title: 'Multiply yourself',
    tagline: 'subagents, /agents',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Claude can spawn copies of itself to work in parallel. Ask it to "use subagents to search these 5 directories" and watch the fan-out.
        </Text>
        <FrameDemo
          frames={[
            '> find any error handling bugs\n#◐ Spawning 3 agents…',
            '#[warning:◐] agent-1 · scanning api\n#[warning:◐] agent-2 · scanning utils\n#[warning:◐] agent-3 · scanning cli',
            '#[success:✓] agent-1 · found reject\n#[warning:◐] agent-2 · scanning utils\n#[success:✓] agent-3 · no issues',
            'Found 2 issues:\n  [suggestion:api/fetch.ts:42] unhandled\n  [suggestion:utils/retry.ts:18] swallowed',
          ]}
        />
        <Text>
          Define specialized agents in <Cmd>.claude/agents/</Cmd> — a test runner, a code reviewer, a docs writer — each with its own tools and instructions. Run <Cmd>/agents</Cmd> to manage them.
        </Text>
        <Text dimColor>
          Subagents run in isolated context. For true parallel sessions on separate branches, launch with <Cmd>claude --worktree</Cmd>.
        </Text>
      </Box>
    ),
  },
  {
    id: 'cross-device',
    title: 'Code from anywhere',
    tagline: '/remote-control, /teleport',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Run <Cmd>/remote-control</Cmd> and this terminal becomes visible on your phone and at claude.ai/code. Watch output, send prompts, approve tool calls — all from another device while this session keeps running.
        </Text>
        <FrameDemo
          frames={[
            '> [suggestion:/remote-control]\n#◐ connecting…',
            '[success:✓] connected\nsee this session at\n[suggestion:claude.ai/code/abc123]',
            '#─ on your phone ─\n#abc123 · running tests\n[warning:◐] 142 of 284',
            '#─ on your phone ─\n#abc123 · [success:✓] all pass\n> ship it',
          ]}
        />
        <Text>
          Started a session on the web and want to move it here? Run{' '}
          <Cmd>/teleport</Cmd> to pull it into this terminal with full history.
        </Text>
        <Text dimColor>
          Kick off a long task, close your laptop, check progress from your phone.
        </Text>
      </Box>
    ),
  },
  {
    id: 'model-dial',
    title: 'Dial the model',
    tagline: '/model, /effort',
    body: (
      <Box flexDirection="column" gap={1}>
        <Text>
          Run <Cmd>/model</Cmd> to switch models. Opus for hard problems, Sonnet for most work, Haiku for quick questions. Each trades speed for depth.
        </Text>
        <FrameDemo
          frames={[
            '> [suggestion:/effort] high\n#effort set to [claude:high]',
            '> why is the list page slow?\n#[claude:◐ thinking deeply…]',
            'Three hypotheses, ranked:\n 1. N+1 query in loader\n 2. missing index on users',
          ]}
        />
        <Text>
          <Cmd>/effort</Cmd> controls how long Claude thinks before answering.{' '}
          <Key>high</Key> for tricky bugs, <Key>low</Key> when you just need a quick edit.
        </Text>
        <Text dimColor>
          Also: <Cmd>/fast</Cmd> toggles fast mode — same model, faster output.
        </Text>
      </Box>
    ),
  },
]
