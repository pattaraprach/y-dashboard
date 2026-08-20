export const ASIA_BANGKOK_TIME_ZONE = 'Asia/Bangkok'

export const BANGKOK_DATE_STAMP_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: ASIA_BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
