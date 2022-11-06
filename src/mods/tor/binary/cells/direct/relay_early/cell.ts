import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";

export class RelayEarlyCell extends RelayCell {
  readonly class = RelayEarlyCell

  static command = 9
}