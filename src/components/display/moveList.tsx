import { useEffect, useRef } from "react";

interface MovePair {
  number: string,
  white: string,
  black: string
}

// The tracked game is stored as a PGN movetext string ("1. e4 e5 2. Nf3").
const parsePairs = (moves: string): MovePair[] => {
  const pairs: MovePair[] = [];
  const tokens = moves.trim().split(/\s+/).filter((token) => token !== "");

  tokens.forEach((token) => {
    if (token.endsWith(".")) {
      pairs.push({ number: token.slice(0, -1), white: "", black: "" });
      return;
    }
    const pair = pairs[pairs.length - 1];
    if (pair === undefined) {
      // Movetext that starts mid-move (a game resumed from a FEN).
      pairs.push({ number: "…", white: token, black: "" });
      return;
    }
    if (pair.white === "") {
      pair.white = token;
    } else {
      pair.black = token;
    }
  });

  return pairs;
}

const MoveList = ({ moves }: { moves: string }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pairs = parsePairs(moves);

  // Keep the newest move in view on the TV.
  useEffect(() => {
    if (scrollRef.current !== null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  const lastIndex = pairs.length - 1;
  const lastIsBlack = lastIndex >= 0 && pairs[lastIndex].black !== "";

  return (
    <div ref={scrollRef} className="mp-tv-moves-scroll">
      {pairs.length === 0 &&
        <div className="mp-tv-empty">No moves yet</div>
      }
      {pairs.map((pair, index) =>
        <div key={`${pair.number}-${String(index)}`} className="mp-tv-move-row">
          <span className="mp-tv-move-num">{pair.number}.</span>
          <span className={`mp-tv-move-san${index === lastIndex && !lastIsBlack ? " current" : ""}`}>
            {pair.white}
          </span>
          <span className={`mp-tv-move-san${index === lastIndex && lastIsBlack ? " current" : ""}`}>
            {pair.black}
          </span>
        </div>
      )}
    </div>
  );
};

export default MoveList;
