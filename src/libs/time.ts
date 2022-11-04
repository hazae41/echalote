export function now() {
  return ~~(Date.now() / 1000)
}

export function ttlToDate(ttl: number) {
  return new Date(Date.now() + (ttl * 1000))
}

export function dateToTtl(date: Date) {
  return ~~((date.getTime() - Date.now()) / 1000)
}