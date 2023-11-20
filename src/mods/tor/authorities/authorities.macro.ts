/**
 * @macro delete-next-lines
 */
import { $run$ } from "@hazae41/saumon"
import { readFile } from "fs/promises"
import { Fallback } from "../fallbacks/fallback.js"

export namespace Authorities {

  export const fallbacks = $run$(async () => {
    const raw = await readFile(__dirname + "/authorities.json", "utf8")
    return JSON.parse(raw) as Fallback[]
  })

}