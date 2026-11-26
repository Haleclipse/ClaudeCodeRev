import * as React from 'react'
import { Powerup } from '../../components/Powerup/Powerup.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

export const call: LocalJSXCommandCall = async onDone => {
  return <Powerup onExit={result => onDone(result, { display: 'system' })} />
}
