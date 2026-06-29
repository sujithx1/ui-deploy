import { NextRequest } from 'next/server';

/**
 * Validate the request's X-API-Key header against the INTERNAL_API_KEY environment variable.
 */
export function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  console.error("DEBUG API KEY RECEIVED:", apiKey);
  const expectedKey = process.env.INTERNAL_API_KEY || 'secret-key-change-me';

  return apiKey === expectedKey;
}
