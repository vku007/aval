import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getSignedCookies } from '@aws-sdk/cloudfront-signer';
import {
  EditorSessionService,
  editorResource,
  signedCookieHeaders,
  type CloudFrontCookieSigner
} from './EditorSessionService.js';
import { ServiceUnavailableError } from '../../shared/errors/ServiceUnavailableError.js';

function privateKeyPem(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
}

describe('EditorSessionService', () => {
  it('signs cookies for the apex and www editor paths', () => {
    let policy = '';
    const signer: CloudFrontCookieSigner = {
      sign(input) {
        policy = input.policy;
        return {
          'CloudFront-Policy': 'policy',
          'CloudFront-Signature': 'sig',
          'CloudFront-Key-Pair-Id': input.keyPairId
        };
      }
    };
    const service = new EditorSessionService({
      keyPairId: 'KTEST',
      privateKey: 'pem',
      domain: 'vkp-consulting.fr',
      ttlSeconds: 3600,
      now: () => 1_700_000_000_000
    }, signer);

    const { cookies } = service.issue();

    expect(cookies).toHaveLength(3);
    expect(cookies.map((cookie) => cookie.split('=')[0])).toEqual([
      'CloudFront-Policy',
      'CloudFront-Signature',
      'CloudFront-Key-Pair-Id'
    ]);
    for (const cookie of cookies) {
      expect(cookie).toContain('Domain=vkp-consulting.fr');
      expect(cookie).toContain('Path=/editor/');
      expect(cookie).toContain('Max-Age=3600');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    }
    expect(cookies[2]).toContain('KTEST');

    const parsed = JSON.parse(policy);
    expect(parsed.Statement).toHaveLength(1);
    expect(parsed.Statement[0].Resource).toBe(editorResource('vkp-consulting.fr'));
    expect(parsed.Statement[0].Condition.DateLessThan['AWS:EpochTime']).toBe(1_700_000_000 + 3600);
  });

  it('refuses to sign when the key is not configured', () => {
    const service = new EditorSessionService({
      keyPairId: '',
      privateKey: '',
      domain: 'vkp-consulting.fr'
    });
    expect(() => service.issue()).toThrow(ServiceUnavailableError);
  });

  it('produces cookies the CloudFront signer accepts', () => {
    const pem = privateKeyPem();
    const signed = getSignedCookies({
      keyPairId: 'KTEST',
      privateKey: pem,
      policy: JSON.stringify({
        Statement: [{
          Resource: 'https://vkp-consulting.fr/editor/*',
          Condition: { DateLessThan: { 'AWS:EpochTime': 1_800_000_000 } }
        }]
      })
    });
    const cookies = signedCookieHeaders(signed, 'vkp-consulting.fr', 60);
    expect(cookies[0].startsWith('CloudFront-Policy=')).toBe(true);
    expect(cookies[1].startsWith('CloudFront-Signature=')).toBe(true);
  });
});
