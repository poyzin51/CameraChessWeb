// Same-machine sync between the processing tab and /display TV tabs.
// One BroadcastChannel per board so a multi-board layout can be added later
// (each phone/processing tab posts to its own board id).
export interface DisplayMessage {
  fen: string,
  lastMove: string,
  moves: string
}

export const DEFAULT_BOARD_ID = "1";

export const getDisplayChannelName = (boardId: string = DEFAULT_BOARD_ID): string => {
  return `chesscam-display-${boardId}`;
}
