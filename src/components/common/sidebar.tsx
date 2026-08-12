import { Chessboard } from "kokopu-react";
import { DisplayButton, HomeButton, PgnButton } from "./index.tsx";
import { Game, Mode } from "../../types.tsx";
import { useGame } from "../../slices/gameSlice.tsx";

const MODE_HINTS: Record<Mode, string> = {
  record: "Track a live game and copy the PGN when you are done.",
  upload: "Replay a recorded video and turn it into a PGN.",
  broadcast: "Push the game live to a Lichess broadcast round.",
  play: "Play your Lichess game on the physical board."
};

// `mode` covers the four capture screens; Export passes its own title/hint
// because it has no camera attached.
const Sidebar = (props: any) => {
  const game: Game = useGame();
  const mode: Mode | undefined = props.mode;
  const messages: string[] = props.text as string[];

  const title: string = mode ?? props.title;
  const hint: string = mode ? MODE_HINTS[mode] : props.hint;
  const showDisplay: boolean = mode !== undefined;

  return (
    <div ref={props.sidebarRef} className="mp-sidebar">
      <div className="mp-sidebar-brand">
        <img src="/matepoint-logo.png" alt="" />
        <span>MatePoint <span className="mp-brand-gold">ChessCam</span></span>
      </div>

      <div className="mp-sidebar-mode">
        <div className="mp-sidebar-mode-title">{title}</div>
        <div className="mp-sidebar-hint">{hint}</div>
      </div>

      {props.playing &&
        <div className="mp-sidebar-board">
          <Chessboard turnVisible={false} squareSize={24}
            position={game.fen} coordinateVisible={false} />
        </div>
      }

      <div className="mp-label">Controls</div>
      <ul className="mp-sidebar-controls">
        {props.children}
      </ul>

      {showDisplay &&
        <>
          <div className="mp-label">Audience screen</div>
          <DisplayButton />
          <div className="mp-sidebar-hint">Shows the live game on a second screen.</div>
        </>
      }

      {messages.length > 0 &&
        <div className="mp-sidebar-status">
          {messages.map((message: string, i: number) =>
            <div key={i}>{message}</div>
          )}
        </div>
      }

      <div className="mp-sidebar-footer">
        <div className="btn-group w-100" role="group">
          <PgnButton setText={props.setText} playing={props.playing} />
          <HomeButton />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
