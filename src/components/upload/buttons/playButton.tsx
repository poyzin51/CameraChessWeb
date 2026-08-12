import { SetBoolean } from "../../../types";
import { SidebarButton, Icon } from "../../common";

const PlayButton = ({ videoRef, playing, setPlaying }: {
  videoRef: any, playing: boolean, setPlaying: SetBoolean
}) => {
  const handleClick = (e: any) => {
    e.preventDefault();
    
    if (videoRef.current.getAttribute("src")?.startsWith("blob:")) {
      setPlaying(!playing);
    }
  }

 return (
    <SidebarButton onClick={handleClick}>
      <Icon iconName={playing ? "bi-pause-fill" : "bi-play-fill"} />
      {playing ? "Pause" : "Play"}
    </SidebarButton>
  );
};

export default PlayButton;
