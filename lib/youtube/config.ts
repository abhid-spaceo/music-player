/** Region-blocking is evaluated per viewer, so this must be where the owner
 *  actually watches. Wrong value = tracks wrongly flagged region_blocked. */
export function youtubeRegion(): string {
  return (process.env.YOUTUBE_REGION ?? 'IN').toUpperCase();
}

export function youtubeApiKey(): string {
  return process.env.YOUTUBE_API_KEY ?? '';
}
