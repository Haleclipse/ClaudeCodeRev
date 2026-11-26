import memoize from 'lodash-es/memoize.js'
import { isEnvTruthy } from '../utils/envUtils.js'
import { getTimeZone } from '../utils/intl.js'
import { isFirstPartyAnthropicBaseUrl } from '../utils/model/providers.js'

/**
 * Date line for the user context ("Today's date is …"), ported from 2.1.91.
 *
 * Official behavior: when ANTHROPIC_BASE_URL points at a non-first-party
 * host, the apostrophe in "Today's" is swapped for a look-alike that encodes
 * whether the host (or a parent domain) is on an obfuscated domain list
 * (cn and ~150 domestic company / cloud-function / API-relay domains) and
 * whether it contains an AI-lab keyword (deepseek, moonshot, zhipu, …); in
 * the Asia/Shanghai or Asia/Urumqi timezone the date's "-" becomes "/".
 *
 * Rebuild-local switch: this marking only runs when
 * CLAUDE_CODE_REBUILD_DATE_MARKER is truthy (not an official variable).
 * Otherwise the line is the plain 2.1.90 text.
 */
const ENABLE_ENV = 'CLAUDE_CODE_REBUILD_DATE_MARKER'

// Lists are base64 of each byte XOR LIST_XOR_KEY, comma-separated
function decodeList(encoded: string): string[] {
  const bytes = Buffer.from(encoded, 'base64')
  let out = ''
  for (const b of bytes) out += String.fromCharCode(b ^ LIST_XOR_KEY)
  return out.split(',')
}

function getBaseUrlHost(): string | null {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) return null
  try {
    return new URL(baseUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

type EndpointSignals = {
  known: boolean
  labKw: boolean
  cnTZ: boolean
  host: string | null
}

function getEndpointSignals(): EndpointSignals | null {
  if (!isEnvTruthy(process.env[ENABLE_ENV]) || isFirstPartyAnthropicBaseUrl()) {
    return null
  }
  const host = getBaseUrlHost()
  const timeZone = getTimeZone()
  const cnTZ = timeZone === 'Asia/Shanghai' || timeZone === 'Asia/Urumqi'
  if (!host) return { known: false, labKw: false, cnTZ, host: null }
  return {
    known: getKnownHosts().some(d => host === d || host.endsWith('.' + d)),
    labKw: getLabKeywords().some(k => host.includes(k)),
    cnTZ,
    host,
  }
}

function pickApostrophe(known: boolean, labKw: boolean): string {
  if (!known && !labKw) return "'"
  if (known && !labKw) return '’'
  if (!known && labKw) return 'ʼ'
  return 'ʹ'
}

export function formatTodayDateLine(date: string): string {
  const signals = getEndpointSignals()
  const apostrophe = pickApostrophe(
    signals?.known ?? false,
    signals?.labKw ?? false,
  )
  const formatted = signals?.cnTZ ? date.replace(/-/g, '/') : date
  return `Today${apostrophe}s date is ${formatted}.`
}

const LIST_XOR_KEY = 91
const ENCODED_HOSTS =
  'ODV3KDo1MC46MnU4NDZ3NT4vPjooPnU4NDZ3am1odTg0Nnc5OjI/LnYyNS91ODQ2dzk6Mj8udTg0Nnc6NzI5Ojk6djI1OHU4NDZ3OjcyKzoidTg0Nnc6NS88KTQuK3YyNTh1ODV3MC46MigzNC51ODQ2dzkiLz4/OjU4PnU1Pi93IzI6NDM0NTwoMy51ODQ2dzgvKTIrODQpK3U4NDZ3MT91ODQ2dzE/ODc0Lj91ODQ2dzkyNzI5MjcydTg0dzI9NyIvPjB1ODQ2dygvPis9LjV2MjU4dTg0Nnc6NzIiLjU4KHU4NDZ3ODV2KDM6NTwzOjJ1PTg6Kyt1KS41dzg1djk+MjEyNTx1PTg6Kyt1KS41dyM6NjI1MjZ1ODQ2dzY0NDUoMzQvdToydzo1Iik0Li8+KXUvNCt3Kzo4MCI6KzJ1ODQ2dzoyODQ/PjYyKSk0KXU4NDZ3OjI8NDg0Pz51ODQ2dzM0NTwoMzo1dTg0NncyLDM6Nz44NzQuP3U4NDZ3PzM4ND8+KXU1Pi93Nz42NDU8Ky91LzQrdyEzMjMuMjorMnUvNCt3MjUvKDI8dTU+L3czMjwzdj0yLT52OjJ1IyIhdzg3NC4/KCw6InU1Pi93byg6KzJ1ODQ2d25pYmJtanU4NDZ3Y2NiYm11ODc0Lj93Y2M4ND8+dToyd2NjODQ/PnU0KTx3Ymo4ND8+dSspNHdiYmlpaG11IyIhdzoydTg0Pz4qOip1ODQ2dzoydTMiOTwhKHU4NDZ3OjJ1MDEtMzN1ODQ2dzoyODo1OisydTg0Nnc6Mjg0PzI1PHUoM3c6Mj06KC91KDIvPnc6MjMuOTYyI3U4NDZ3OjU2NCkidTg0Nnc6KzJ1bmlraWtoa3UjIiF3OisydTo5NzoydS80K3c6KzJ1OTI6NSMyPnU6Mnc6KzJ1OTcvOCJ1OjJ3OisydTgrOigodTg4dzorMnU/Pi1jY3UvPjgzdzorMnU/KT46Njw+KXU4NDZ3OisydT4jKzo1KDI0NXU4MzovdzorMnU8Lj46MnU4NDZ3OisydTM0Nz86MnUvNCt3OisydTIwLjU4ND8+dTg4dzorMnU3ODQ1OjJ1ODQ2dzorMnU3MjUwOisydTQpPHc6KzJ1NjA+OjJ1ODQ2dzorMnU1PjA0OisydTg0Nnc6KzJ1NDoyKyk0dTg0Nnc6KzJ1KS4iLjV1PS41dzorMnUoKDQrPjV1LzQrdzorMnUvLnYhMnU4NDZ3OisydS48NyI4Oi91ODh3OisydS1odTg2dzorMnUsMzovOjJ1ODh3OisydSwrPCEodS80K3c6KzJ1Iy8idTorK3c6KzJ1Ii4+PDc+dTg0Nnc6KzJ1ISEiLnU2Pnc6KzI2OikvdToydzorMispNHU2OiI1NClqa2lvdTcyLT53OisyIjJ1ODQ2dzorKzciMXUzMjorMnUvNCt3Oi48Ni41L3U4NDZ3OW8udSohIXUyNHc4NzouPz8idTg0Nnc4NzouPz52ODQ/PnYzLjl1Oisrdzg3Oi4/PnY0Ky4odS80K3c4NzouPz4yPz51NT4vdzg0dSI+KHUtPHc4ND8+dSw+NSw+NXY6MnU4NDZ3ODQ/PnUjdjoyNHU4NDZ3ODQ/PjI3Ojl1ODQ2dzguOT41OD51ODQ2dz8+PispNC4vPil1LzQrdz8yNjopOiJ1ODQ2dz82IzorMnU4NDZ3PzQ4KHU6Mjw4aT91ODQ2dz8uODA4ND8yNTx1ODQ2dz0wdTMoMywwdTQpPHc9NzorODQ/PnU4NDZ3PTQjODQ/PnUzKDMsMHU0KTx3PTQjODQ/PnUpMTF1ODh3PS43MnUzIzJ1Nj53PD4vPDQ6KzJ1ODQ2dzwrL3UhMzIhPjU8IT41PHU4NDZ3PCsvPDQ/dTg3NC4/dzwrLzA+InU+LnU0KTx3PCsvKzoidSgvNCk+dzM/PCg5dTg0NnczPjU6KzJ1LzQrdzI1KC84NCsyNzQvdjorMnU4NDZ3MT41MiI6dS80K3cxMj4wNC51OjJ3MDx2OisydTg3NC4/dzVqNXU6Mnc1Pix2OisydS5vLSl1ODQ2dzU+LHUjIjgzOi86MnU4NDZ3NDU+djorMnU5Ny84InUvNCt3NDU+dTQ4NDQ3OjJ1ODQ2dzQ1PjorMnUrOjI1Lzk0L3UvNCt3NCs+NXUjMjo0MTI1PDoydTg0Nnc0Kz41ODc6Lj8+dTY+dzQrLih1PCsvLi51ODQ2dys0NzQ6MnUvNCt3KzQ3NDorMnUvNCt3KykyLTU0Pz51ODQ2dyspNCMiOjJ1ODQ2dyoyNSEzMjoydTg0NncpMjwzL3U4ND8+KHcpLjU6NSIvMjY+dTMjMnU2PncoKCg6Mjg0Pz51ODQ2dygvNCk+dSEhIi4odS80K3cvMjo1LzI6NToydSspNHcuMi4yOisydTg0NncuNTI6KzJ1OjJ3LTIrdS41PyIyNTw6KzJ1ODQ2dyw0Nz06MnUvNCt3LCEsdT8+bnU1Pi93LCEsdSsrdS46dyM6Mik0Li8+KXU4NDZ3IzoyIzorMnU4NDZ3IzI6NDMuOisydSgyLz53IzI6NDMuNjI1MnUoMi8+dyMidSs0NzQ6KzJ1ODQ2dyI6NSg/bW1tdTg0NnciOjUoP21tbXUvNCt3Ii41LC51OjJ3Ii41LC51IT46OS4pdTorK3chPjU2LiN1OjI='
const ENCODED_LAB_KEYWORDS =
  'Pz4+Kyg+PjB3NjQ0NSgzNC93NjI1MjY6I3cjOjYyNTI2dyEzMisudzkyPDY0Pz43dzk6MjgzLjo1dygvPis9LjV3a2o6Mnc/OigzKDg0Kz53LTQ3OD4o'

const getKnownHosts = memoize(() => decodeList(ENCODED_HOSTS))
const getLabKeywords = memoize(() => decodeList(ENCODED_LAB_KEYWORDS))
