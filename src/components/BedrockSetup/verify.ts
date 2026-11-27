import type { AwsCredentialIdentityProvider } from '@aws-sdk/types'
import {
  applyBedrockAuth,
  applyBedrockRegionPrefix,
  type BedrockAuthConfig,
  type BedrockRegionPrefix,
} from '../../utils/model/bedrock.js'
import { ALL_MODEL_CONFIGS, type ModelKey } from '../../utils/model/configs.js'
import {
  DEFAULT_3P_HAIKU_KEY,
  DEFAULT_3P_OPUS_KEY,
  DEFAULT_3P_SONNET_KEY,
} from '../../utils/model/model.js'
import { getAWSClientProxyConfig } from '../../utils/proxy.js'
import type { BedrockWizardData } from './steps.js'

export type ModelTestFailure =
  | 'auth'
  | 'permission'
  | 'model'
  | 'network'
  | 'other'

export type ModelTestResult = { ok: boolean; reason?: ModelTestFailure }

export type VerifyResult =
  | { status: 'ok'; identity: string; profiles: string[]; note?: string }
  | { status: 'error'; error: string; command?: string }

export function getDefaultModelsForRegion(region: string | undefined): {
  sonnet: { needle: string; fallback: string }
  opus: { needle: string; fallback: string }
  haiku: { needle: string; fallback: string }
} {
  const prefix = getInferenceProfilePrefix(region)
  const tier = (key: ModelKey) => ({
    needle: ALL_MODEL_CONFIGS[key].firstParty,
    fallback: applyBedrockRegionPrefix(ALL_MODEL_CONFIGS[key].bedrock, prefix),
  })
  return {
    sonnet: tier(DEFAULT_3P_SONNET_KEY),
    opus: tier(DEFAULT_3P_OPUS_KEY),
    haiku: tier(DEFAULT_3P_HAIKU_KEY),
  }
}

export async function verifyBedrockCredentials(
  data: BedrockWizardData,
): Promise<VerifyResult> {
  if (data.authMethod === 'bearer') return verifyBearerToken(data)
  try {
    const credentials = await getCredentialProvider(data)
    const clientConfig = {
      ...(await getAWSClientProxyConfig()),
      region: data.region,
      ...(credentials && { credentials }),
    }
    const { STSClient, GetCallerIdentityCommand } = await import(
      '@aws-sdk/client-sts'
    )
    const caller = await new STSClient(clientConfig).send(
      new GetCallerIdentityCommand({}),
    )
    const identity = caller.Arn ?? caller.UserId ?? '(unknown)'
    const { BedrockClient, ListInferenceProfilesCommand } = await import(
      '@aws-sdk/client-bedrock'
    )
    const bedrock = new BedrockClient(clientConfig)
    const profiles: string[] = []
    let nextToken: string | undefined
    do {
      const page = await bedrock.send(
        new ListInferenceProfilesCommand({
          ...(nextToken && { nextToken }),
          typeEquals: 'SYSTEM_DEFINED',
        }),
      )
      for (const summary of page.inferenceProfileSummaries ?? [])
        if (summary.inferenceProfileId?.includes('anthropic'))
          profiles.push(summary.inferenceProfileId)
      nextToken = page.nextToken
    } while (nextToken)
    return { status: 'ok', identity, profiles }
  } catch (error) {
    return { status: 'error', ...describeAwsError(error, data) }
  }
}

export async function testModel(
  data: BedrockWizardData,
  model: string,
): Promise<ModelTestResult> {
  let client
  try {
    client = await createClient(data)
  } catch {
    return { ok: false, reason: 'auth' }
  }
  try {
    await client.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: 'user', content: '.' }],
    })
    return { ok: true }
  } catch (error) {
    const status = (error as { status?: number } | undefined)?.status
    if (status === 401) return { ok: false, reason: 'auth' }
    if (status === 403) return { ok: false, reason: 'permission' }
    if (status === 400 || status === 404) return { ok: false, reason: 'model' }
    if (status === 429) return { ok: true }
    if (status === undefined) return { ok: false, reason: 'network' }
    return { ok: false, reason: 'other' }
  }
}

async function createClient(data: BedrockWizardData) {
  const [{ AnthropicBedrock }, { getProxyFetchOptions }] = await Promise.all([
    import('@anthropic-ai/bedrock-sdk'),
    import('../../utils/proxy.js'),
  ])
  const options = {
    awsRegion: data.region,
    maxRetries: 0,
    fetchOptions: getProxyFetchOptions({ forAnthropicAPI: true }),
  }
  return new AnthropicBedrock(
    applyBedrockAuth(options, await toBedrockAuth(data)),
  )
}

async function toBedrockAuth(
  data: BedrockWizardData,
): Promise<BedrockAuthConfig> {
  if (data.authMethod === 'bearer')
    return { kind: 'bearer', token: data.bearerToken! }
  const provider = await getCredentialProvider(data)
  if (!provider) return { kind: 'default' }
  const credentials = await provider()
  return {
    kind: 'sigv4',
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    sessionToken: credentials.sessionToken,
  }
}

async function verifyBearerToken(
  data: BedrockWizardData,
): Promise<VerifyResult> {
  const model = getDefaultModelsForRegion(data.region).haiku.fallback
  const result = await testModel(data, model)
  if (result.ok)
    return {
      status: 'ok',
      identity: 'Bedrock API key',
      profiles: [],
      note: `Test request to ${model} succeeded.`,
    }
  switch (result.reason) {
    case 'auth':
      return {
        status: 'error',
        error: 'Invalid Bedrock API key. Check the key and try again.',
      }
    case 'permission':
      return {
        status: 'error',
        error:
          'API key was rejected. Your IAM policy may be missing bedrock:CallWithBearerToken or bedrock:InvokeModel.',
      }
    case 'model':
      return {
        status: 'ok',
        identity: 'Bedrock API key',
        profiles: [],
        note: `The key works, but ${model} is not enabled in your account. Pin a model you have access to on the next step.`,
      }
    case 'network':
      return {
        status: 'error',
        error: `Could not reach Bedrock in region "${data.region}". Check the region name and your network.`,
      }
    case 'other':
      return {
        status: 'error',
        error: 'The test request failed. Check the key and region.',
      }
  }
}

async function getCredentialProvider(
  data: BedrockWizardData,
): Promise<AwsCredentialIdentityProvider | undefined> {
  switch (data.authMethod) {
    case 'profile': {
      const { fromNodeProviderChain } = await import(
        '@aws-sdk/credential-providers'
      )
      return fromNodeProviderChain({
        profile: data.awsProfile,
        ignoreCache: true,
      })
    }
    case 'accessKey':
      return async () => ({
        accessKeyId: data.accessKeyId!,
        secretAccessKey: data.secretAccessKey!,
        ...(data.sessionToken && { sessionToken: data.sessionToken }),
      })
    case 'environment':
      return undefined
    default:
      return undefined
  }
}

function describeAwsError(
  error: unknown,
  data: BedrockWizardData,
): { error: string; command?: string } {
  const err = error as { name?: string; message?: string } | undefined
  const name = err?.name ?? 'Error'
  const message = err?.message ?? String(error)
  const ssoLogin =
    data.authMethod === 'profile'
      ? `aws sso login --profile ${data.awsProfile}`
      : undefined
  switch (name) {
    case 'CredentialsProviderError':
      return data.authMethod === 'profile'
        ? {
            error: `Could not load credentials for profile "${data.awsProfile}". If this is an SSO profile, run:`,
            command: ssoLogin,
          }
        : { error: `No AWS credentials found. ${message}` }
    case 'ExpiredTokenException':
    case 'TokenRefreshRequired':
      return data.authMethod === 'profile'
        ? { error: 'SSO session expired. Run:', command: ssoLogin }
        : { error: `Credentials expired. ${message}` }
    case 'ForbiddenException':
      return data.authMethod === 'profile'
        ? {
            error: `SSO portal denied access to the role for profile "${data.awsProfile}". The permission set may have been revoked — check your AWS access portal.`,
          }
        : { error: `Forbidden. ${message}` }
    case 'AccessDeniedException':
      return {
        error: `Access denied. Your IAM role needs bedrock:ListInferenceProfiles permission. ${message}`,
      }
    case 'UnrecognizedClientException':
    case 'InvalidSignatureException':
      return { error: `Invalid credentials. ${message}` }
    case 'UnknownEndpoint':
    case 'ENOTFOUND':
      return {
        error: `Cannot reach AWS in region "${data.region}". Check the region name and your network.`,
      }
    default:
      return { error: `${name}: ${message}` }
  }
}

function getInferenceProfilePrefix(
  region: string | undefined,
): BedrockRegionPrefix {
  const value = region ?? ''
  if (value.startsWith('us-') && !value.startsWith('us-gov-')) return 'us'
  if (value.startsWith('eu-')) return 'eu'
  if (value.startsWith('ap-')) return 'apac'
  return 'global'
}
