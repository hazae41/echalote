export function lastOf<T>(array: T[]) {
  return array[array.length - 1]
}

export function randomOf<T>(array: T[]): T | undefined {
  return array[Math.floor(Math.random() * array.length)]
}