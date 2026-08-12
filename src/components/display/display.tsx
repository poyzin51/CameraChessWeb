import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Chessground } from "chessground";
import { Api } from "chessground/api";
import { Key } from "chessground/types";
import { useGame } from "../../slices/gameSlice";
import { Game } from "../../types";
import { DEFAULT_BOARD_ID, DisplayMessage, getDisplayChannelName } from "../../utils/displayChannel";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

const uciToPair = (uci: string): [Key, Key] | undefined => {
  if (uci.length < 4) {
    return undefined;
  }
  return [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];
}

// Fullscreen TV board: renders whatever position the processing tab tracks,
// including illegal ones. Fed over a BroadcastChannel; the persisted Redux
// game provides the position shown before the first message arrives.
const Display = () => {
  const game: Game = useGame();
  const [searchParams] = useSearchParams();
  const boardId: string = searchParams.get("board") ?? DEFAULT_BOARD_ID;
  const orientation = searchParams.get("orientation") === "black" ? "black" : "white";

  const boardElRef = useRef<HTMLDivElement | null>(null);
  const initialGameRef = useRef<Game>(game);

  useEffect(() => {
    if (boardElRef.current === null) {
      return;
    }

    const api: Api = Chessground(boardElRef.current, {
      fen: initialGameRef.current.fen,
      lastMove: uciToPair(initialGameRef.current.lastMove),
      orientation: orientation,
      viewOnly: true,
      coordinates: false,
      disableContextMenu: true,
      animation: { enabled: true, duration: 200 },
      drawable: { enabled: false, visible: false }
    });

    const channel = new BroadcastChannel(getDisplayChannelName(boardId));
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data as DisplayMessage;
      api.set({
        fen: message.fen,
        lastMove: uciToPair(message.lastMove)
      });
    };

    return () => {
      channel.close();
      api.destroy();
    };
  }, [boardId, orientation]);

  const pageStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "#1a1a1b",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.2vh"
  };

  const boardStyle: React.CSSProperties = {
    width: "min(96vw, 88vh)",
    height: "min(96vw, 88vh)",
    boxShadow: "0 0 40px rgba(0, 0, 0, 0.6)"
  };

  const brandStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.8em",
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: "min(3.2vh, 4vw)",
    fontWeight: 600,
    letterSpacing: "0.06em",
    userSelect: "none"
  };

  return (
    <div style={pageStyle}>
      <div ref={boardElRef} style={boardStyle} />
      <div style={brandStyle}>
        <img src="/matepoint-logo.png" alt="" style={{ height: "2em", width: "auto" }} />
        <span>
          MatePoint <span style={{ color: "#f0b429" }}>Academy</span> Chess Club
        </span>
      </div>
    </div>
  );
};

export default Display;
