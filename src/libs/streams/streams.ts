export namespace Streams {

  export function isCloseError(error: unknown): error is Error {
    if (!(error instanceof Error))
      return false

    /**
     * Firefox
     */
    if (error.message === "Terminating the stream")
      return true

    /**
     * Chrome
     */
    if (error.message === "The transform stream has been terminated")
      return true

    /**
     * Safari
     */
    if (error.message === "the stream has been terminated")
      return true

    return false
  }
}