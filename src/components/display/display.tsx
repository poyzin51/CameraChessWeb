import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Chessground } from "chessground";
import { Api } from "chessground/api";
import { Key } from "chessground/types";
import { useGame } from "../../slices/gameSlice";
import { Game } from "../../types";
import {
  DEFAULT_BOARD_ID, DISPLAY_STALE_MS, DisplayMessage, getDisplayChannelName
} from "../../utils/displayChannel";
import MoveList from "./moveList";
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

const uciToPair = (uci: string): [Key, Key] | undefined => {
  if (uci.length < 4) {
    return undefined;
  }
  return [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key];
}

const sideToMove = (fen: string): "white" | "black" => {
  return fen.split(" ")[1] === "b" ? "black" : "white";
}

// The last SAN in the PGN reads better on a TV than the raw UCI we track with.
const lastSan = (moves: string): string => {
  const tokens = moves.trim().split(/\s+/).filter((t) => t !== "" && !t.endsWith("."));
  return tokens.length === 0 ? "Not started" : tokens[tokens.length - 1];
}

const moveNumber = (fen: string): string => {
  const fullmoves = fen.split(" ")[5];
  return fullmoves === undefined ? "1" : fullmoves;
}

type Connection = "waiting" | "live" | "stale";

const STATUS_TEXT: Record<Connection, string> = {
  waiting: "Waiting for camera",
  live: "Live",
  stale: "Signal lost"
};

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
  const lastMessageAtRef = useRef<number | null>(null);

  const [position, setPosition] = useState<DisplayMessage>({
    fen: initialGameRef.current.fen,
    lastMove: initialGameRef.current.lastMove,
    moves: initialGameRef.current.moves
  });
  const [connection, setConnection] = useState<Connection>("waiting");
  const shownRef = useRef<DisplayMessage>(position);

  // Chessground measures its container, so it must be built after layout.
  useLayoutEffect(() => {
    if (boardElRef.current === null) {
      return;
    }

    const api: Api = Chessground(boardElRef.current, {
      fen: initialGameRef.current.fen,
      lastMove: uciToPair(initialGameRef.current.lastMove),
      orientation: orientation,
      viewOnly: true,
      coordinates: true,
      disableContextMenu: true,
      animation: { enabled: true, duration: 200 },
      drawable: { enabled: false, visible: false }
    });

    const channel = new BroadcastChannel(getDisplayChannelName(boardId));
    channel.onmessage = (event: MessageEvent) => {
      const message = event.data as DisplayMessage;
      lastMessageAtRef.current = Date.now();
      setConnection("live");

      // Most messages are heartbeats repeating the current position; skip the
      // re-render and the board redraw unless something actually moved.
      if (message.fen === shownRef.current.fen && message.moves === shownRef.current.moves) {
        return;
      }
      shownRef.current = message;
      setPosition(message);
      api.set({
        fen: message.fen,
        lastMove: uciToPair(message.lastMove)
      });
    };

    const onResize = () => api.redrawAll();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      channel.close();
      api.destroy();
    };
  }, [boardId, orientation]);

  // The processing tab heartbeats, so silence means it closed or slept.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const lastMessageAt = lastMessageAtRef.current;
      if (lastMessageAt === null) {
        return;
      }
      if (Date.now() - lastMessageAt > DISPLAY_STALE_MS) {
        setConnection("stale");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const turn = sideToMove(position.fen);

  return (
    <div className="mp-tv">
      <div className="mp-tv-header">
        <div className="mp-tv-brand">
          <img src="/matepoint-logo.png" alt="" />
          <span>MatePoint <span className="mp-brand-gold">Academy</span> Chess Club</span>
        </div>
        <div className="mp-tv-status">
          <span className={`mp-tv-dot ${connection}`} />
          <span>{STATUS_TEXT[connection]}</span>
        </div>
      </div>

      <div className="mp-tv-body">
        <div className="mp-tv-panel mp-tv-panel-left">
          <div className="mp-tv-card">
            <div className="mp-tv-card-label">To move</div>
            <div className="mp-tv-card-value mp-tv-turn">
              <span className={`mp-tv-turn-disc ${turn}`} />
              <span>{turn === "white" ? "White" : "Black"}</span>
            </div>
          </div>
          <div className="mp-tv-card">
            <div className="mp-tv-card-label">Last move</div>
            <div className="mp-tv-card-value mp-brand-gold">{lastSan(position.moves)}</div>
          </div>
          <div className="mp-tv-card">
            <div className="mp-tv-card-label">Move number</div>
            <div className="mp-tv-card-value">{moveNumber(position.fen)}</div>
          </div>
        </div>

        <div ref={boardElRef} className="mp-tv-board" />

        <div className="mp-tv-panel mp-tv-panel-right">
          <div className="mp-tv-card mp-tv-moves">
            <div className="mp-tv-card-label">Moves</div>
            <MoveList moves={position.moves} />
          </div>
        </div>
      </div>

      <div className="mp-tv-footer">
        Board {boardId} &middot; Live from the board camera
      </div>
    </div>
  );
};

export default Display;
