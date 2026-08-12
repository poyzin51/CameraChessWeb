// Same-machine sync between the processing tab and /display TV tabs.
// One BroadcastChannel per board so a multi-board layout can be added later
// (each phone/processing tab posts to its own board id).
export interface DisplayMessage {
  fen: string,
  lastMove: string,
  moves: string
}

export const DEFAULT_BOARD_ID = "1";

// The processing tab re-posts the current position on this interval so a TV
// tab opened mid-game catches up immediately and can tell "live" from "the
// laptop went to sleep". Moves are also posted the moment they happen.
export const DISPLAY_HEARTBEAT_MS = 3000;

// A display is considered live if a message arrived within this window.
export const DISPLAY_STALE_MS = DISPLAY_HEARTBEAT_MS * 3;

export const getDisplayChannelName = (boardId: string = DEFAULT_BOARD_ID): string => {
  return `chesscam-display-${boardId}`;
}
