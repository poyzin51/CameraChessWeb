import { SetBoolean } from "../../types";
import Icon from "./icon";
import SidebarButton from "./sidebarButton";

const RecordButton = ({ playing, setPlaying }: 
  { playing: boolean, setPlaying: SetBoolean }) => {
  const handleClick = (e: any) => {
    e.preventDefault();

    setPlaying(!playing);
  }

 return (
    <SidebarButton onClick={handleClick}
      title={playing ? "Pause tracking" : "Start tracking the game"}>
      <Icon iconName={playing ? "bi-pause-fill" : "bi-play-fill"} />
      {playing ? "Pause" : "Start"}
    </SidebarButton>
  );
};

export default RecordButton;
