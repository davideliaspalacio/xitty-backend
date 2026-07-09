const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const BOGOTA_UTC_OFFSET_HOURS = 5;

type PromotionBoundary = 'start' | 'end';

function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function normalizePromotionBoundary(
  value: string,
  boundary: PromotionBoundary,
): string {
  if (!DATE_ONLY_RE.test(value)) return value;

  const { year, month, day } = parseDateOnly(value);
  const utcHour =
    boundary === 'start'
      ? BOGOTA_UTC_OFFSET_HOURS
      : 24 + BOGOTA_UTC_OFFSET_HOURS - 1;
  const utcMinute = boundary === 'start' ? 0 : 59;
  const utcSecond = boundary === 'start' ? 0 : 59;
  const utcMillisecond = boundary === 'start' ? 0 : 999;

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      utcHour,
      utcMinute,
      utcSecond,
      utcMillisecond,
    ),
  ).toISOString();
}

export function normalizePromotionWindow<
  T extends { starts_at: string; ends_at: string },
>(dto: T): T {
  return {
    ...dto,
    starts_at: normalizePromotionBoundary(dto.starts_at, 'start'),
    ends_at: normalizePromotionBoundary(dto.ends_at, 'end'),
  };
}

export function isPromotionWindowValid(startsAt: string, endsAt: string) {
  return new Date(endsAt) > new Date(startsAt);
}
