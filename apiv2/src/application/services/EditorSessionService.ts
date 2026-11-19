import { getSignedCookies } from '@aws-sdk/cloudfront-signer';
import { ServiceUnavailableError } from '../../shared/errors/ServiceUnavailableError.js';
import { loadSigningKey } from '../../infrastructure/cloudfront/SigningKey.js';

const TTL_SECONDS = 3600;

export interface EditorSessionConfig {
  keyPairId: string;
  privateKey: string;
  domain: string;
  ttlSeconds?: number;
  now?: () => number;
}

export interface SignedCookieSet {
  'CloudFront-Policy'?: string;
  'CloudFront-Signature'?: string;
  'CloudFront-Key-Pair-Id'?: string;
}

export interface CloudFrontCookieSigner {
  sign(input: { keyPairId: string; privateKey: string; policy: string }): SignedCookieSet;
}

const sdkSigner: CloudFrontCookieSigner = {
  sign(input) {
    return getSignedCookies(input);
  }
};

export class EditorSessionService {
  constructor(
    private readonly config: EditorSessionConfig,
    private readonly signer: CloudFrontCookieSigner = sdkSigner
  ) {}

  issue(): { cookies: string[] } {
    if (!this.config.keyPairId || !this.config.privateKey || !this.config.domain) {
      throw new ServiceUnavailableError('Editor signing is not configured');
    }
    const ttl = this.config.ttlSeconds ?? TTL_SECONDS;
    const now = this.config.now ?? Date.now;
    const expires = Math.floor(now() / 1000) + ttl;
    const policy = JSON.stringify({
      Statement: [{
        Resource: editorResource(this.config.domain),
        Condition: { DateLessThan: { 'AWS:EpochTime': expires } }
      }]
    });
    const signed = this.signer.sign({
      keyPairId: this.config.keyPairId,
      privateKey: this.config.privateKey,
      policy
    });
    return { cookies: signedCookieHeaders(signed, this.config.domain, ttl) };
  }
}

export function editorResource(domain: string): string {
  return `https://${domain}/editor/*`;
}

export function signedCookieHeaders(
  signed: SignedCookieSet,
  domain: string,
  ttlSeconds: number
): string[] {
  const names = ['CloudFront-Policy', 'CloudFront-Signature', 'CloudFront-Key-Pair-Id'] as const;
  return names.map((name) => {
    const value = signed[name];
    if (!value) {
      throw new ServiceUnavailableError('Editor signing did not return cookies');
    }
    return `${name}=${value}; Domain=${domain}; Path=/editor/; Max-Age=${ttlSeconds}; Secure; HttpOnly; SameSite=Lax`;
  });
}

export async function openEditorSession(): Promise<EditorSessionService> {
  const parameterName = process.env.EDITOR_SIGNING_KEY_PARAMETER ?? '';
  const privateKey = await loadSigningKey(parameterName);
  return new EditorSessionService({
    keyPairId: process.env.EDITOR_CLOUDFRONT_KEY_PAIR_ID ?? '',
    privateKey,
    domain: process.env.EDITOR_COOKIE_DOMAIN ?? ''
  });
}
