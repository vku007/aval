import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

let cachedKey: string | undefined;

export function resetSigningKeyCache(): void {
  cachedKey = undefined;
}

export async function loadSigningKey(
  parameterName: string,
  read: (name: string) => Promise<string> = readSecureParameter
): Promise<string> {
  if (!parameterName) return '';
  if (cachedKey !== undefined) return cachedKey;
  const value = (await read(parameterName)).trim();
  cachedKey = value;
  return value;
}

async function readSecureParameter(name: string): Promise<string> {
  const client = new SSMClient({});
  const result = await client.send(new GetParameterCommand({
    Name: name,
    WithDecryption: true
  }));
  return result.Parameter?.Value ?? '';
}
