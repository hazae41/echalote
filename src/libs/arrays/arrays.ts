export namespace Arrays {

  export function last<T>(array: T[]) {
    return array[array.length - 1]
  }

  export function random<T>(array: T[]): T | undefined {
    return array[Math.floor(Math.random() * array.length)]
  }

}