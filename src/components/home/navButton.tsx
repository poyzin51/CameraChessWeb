import { useNavigate } from "react-router-dom";
import { useUser } from "../../slices/userSlice";

const NavButton = ({ text, subtitle, tokenRequired }: {
  text: string, subtitle: string, tokenRequired: boolean
}) => {
  const navigate = useNavigate();
  const token = useUser().token;

  const locked = (token === "") && tokenRequired;

  const handleClick = () => {
    if (locked) {
      return;
    }
    void navigate(`/${text.toLowerCase()}`);
  }

  return (
    <button
      className="mp-nav-btn"
      onClick={handleClick}
      disabled={locked}
      title={locked ? "Login with Lichess to use this" : subtitle}
    >
      <div className="mp-nav-btn-title">{text}</div>
      <div className="mp-nav-btn-sub">{locked ? "Login required" : subtitle}</div>
    </button>
  )
}

export default NavButton;
