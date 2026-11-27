import type { ClientOptions } from '@anthropic-ai/bedrock-sdk'

export type BedrockAuthConfig =
  | { kind: 'bearer'; token: string }
  | {
      kind: 'sigv4'
      accessKeyId: string
      secretAccessKey: string
      sessionToken?: string
    }
  | { kind: 'default' }

export function applyBedrockAuth(
  options: ClientOptions,
  auth: BedrockAuthConfig,
): ClientOptions {
  switch (auth.kind) {
    case 'bearer':
      return {
        ...options,
        skipAuth: true,
        defaultHeaders: {
          ...options?.defaultHeaders,
          Authorization: `Bearer ${auth.token}`,
        },
      }
    case 'sigv4':
      return {
        ...options,
        awsAccessKey: auth.accessKeyId,
        awsSecretKey: auth.secretAccessKey,
        awsSessionToken: auth.sessionToken,
      }
    case 'default':
      return options
  }
}
