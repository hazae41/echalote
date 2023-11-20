/**
 * @macro delete-next-lines
 */
import { $run$ } from "@hazae41/saumon"
import { readFile } from "fs/promises"
import { OldFallback } from "../fallbacks/fallback.js"

export namespace Fallbacks {

  export const fallbacks = $run$(async () => {
    const raw = await readFile("./tools/fallbacks2/fallbacks.json", "utf8")
    return JSON.parse(raw) as OldFallback[]
  })

}