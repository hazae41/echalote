import { Writable } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";

export class RelayEarlyCell<T extends Writable> extends RelayCell<T> {
  readonly #class = RelayEarlyCell

  static command = 9

  get command() {
    return this.#class.command
  }

}