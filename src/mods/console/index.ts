export namespace Console {
  export let debugging = false

  export function log(...params: any[]) {
    if (!debugging)
      return
    console.log(...params)
  }

  export function debug(...params: any[]) {
    if (!debugging)
      return
    console.debug(...params)
  }

  export function error(...params: any[]) {
    if (!debugging)
      return
    console.error(...params)
  }

  export function warn(...params: any[]) {
    if (!debugging)
      return
    console.warn(...params)
  }

}