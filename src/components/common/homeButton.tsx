import { useNavigate } from "react-router-dom";
import SidebarButton from "./sidebarButton";
import Icon from "./icon";

const HomeButton = () => {
  const navigate = useNavigate();

  const handleClick = () => {    
    void navigate("/");
  }
  
  return (
    <SidebarButton onClick={handleClick} title="Back to the menu">
      <Icon iconName="bi-house" />
      Menu
    </SidebarButton>
  );
};

export default HomeButton;
