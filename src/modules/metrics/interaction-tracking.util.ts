import { createHash } from 'crypto';

export type TrackableInteractionType =
  | 'profile_view'
  | 'call_click'
  | 'whatsapp_click'
  | 'reservation_click'
  | 'directions_click'
  | 'promo_view'
  | 'ad_impression';

export interface TrackingContext {
  userAgent?: string | null;
}

const PROFILE_VIEW_WINDOW_MS = 10 * 60_000;
const CLICK_WINDOW_MS = 2 * 60_000;
const IMPRESSION_WINDOW_MS = 10 * 60_000;

const BOT_USER_AGENT_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /whatsapp/i,
  /telegrambot/i,
  /linkedinbot/i,
  /twitterbot/i,
  /preview/i,
  /headlesschrome/i,
  /lighthouse/i,
];

export function hashTrackingValue(value?: string | null): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isDuplicateInteractionError(error: unknown): boolean {
  const record = isRecord(error) ? error : {};
  const code = stringField(record, 'code');
  const message = stringField(record, 'message').toLowerCase();
  const details = stringField(record, 'details').toLowerCase();
  return (
    code === '23505' ||
    message.includes('duplicate key') ||
    details.includes('microsite_interactions_dedup_key')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

export function buildInteractionTrackingFields(input: {
  placeId: string;
  interactionType: TrackableInteractionType;
  promoId?: string | null;
  userId?: string | null;
  anonymousSessionId?: string | null;
  userAgent?: string | null;
  now?: Date;
}) {
  const anonymousSessionHash = hashTrackingValue(input.anonymousSessionId);
  const userAgentHash = hashTrackingValue(input.userAgent);
  const actorKey = input.userId
    ? `user:${input.userId}`
    : anonymousSessionHash
      ? `anon:${anonymousSessionHash}`
      : userAgentHash
        ? `ua:${userAgentHash}`
        : 'anon:unknown';

  const nowMs = input.now?.getTime() ?? Date.now();
  const windowMs = dedupWindowMs(input.interactionType);
  const bucket = Math.floor(nowMs / windowMs);
  const promoKey = input.promoId ?? 'none';
  const dedupKey = [
    input.placeId,
    input.interactionType,
    promoKey,
    actorKey,
    bucket,
  ].join(':');

  return {
    anonymous_session_hash: anonymousSessionHash,
    user_agent_hash: userAgentHash,
    dedup_key: dedupKey,
    metadata: {
      source: 'web',
      dedup_window_seconds: Math.floor(windowMs / 1000),
    },
  };
}

function dedupWindowMs(type: TrackableInteractionType): number {
  if (type === 'profile_view') return PROFILE_VIEW_WINDOW_MS;
  if (type === 'ad_impression') return IMPRESSION_WINDOW_MS;
  return CLICK_WINDOW_MS;
}
