export namespace Console {
  export let debugging = false

  export function debug(...params: any[]) {
    if (!debugging)
      return
    console.debug(...params)
  }

}