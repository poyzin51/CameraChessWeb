import { useState } from "react";
import { Sidebar, StudyButton } from "../common";
import ExportButton from "./exportButton";
import { Study } from "../../types";

const UploadSidebar = ({ pgn }: { pgn: string }) => {
  const [study, setStudy] = useState<Study | null>(null);
  const [text, setText] = useState<string[]>([]);

  return (
    <Sidebar playing={false} text={text} setText={setText}
      title="Export" hint="Send the finished game to one of your Lichess studies.">
      <li>
        <StudyButton study={study} setStudy={setStudy} onlyBroadcasts={false} />
      </li>
      <li>
        <ExportButton study={study} setText={setText} pgn={pgn} />
      </li>
    </Sidebar>
  );
};

export default UploadSidebar;