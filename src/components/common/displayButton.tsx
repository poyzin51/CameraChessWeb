import SidebarButton from "./sidebarButton";
import Icon from "./icon";

// Opens the spectator board in a second tab. It listens on a BroadcastChannel,
// so it must stay on this machine: drag the tab to the TV and fullscreen it.
const DisplayButton = () => {
  const handleClick = () => {
    window.open("/display", "_blank", "noopener");
  }

  return (
    <SidebarButton onClick={handleClick}
      title="Opens a second tab with the live game — move it to the TV screen">
      <Icon iconName="bi-tv" />
      Open TV Board
    </SidebarButton>
  );
};

export default DisplayButton;
