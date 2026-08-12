import { useNavigate } from "react-router-dom";
import { useUser } from "../../slices/userSlice";
import { lichessLogin, lichessLogout } from "../../utils/lichess";
import { useDispatch } from "react-redux";

const Header = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { username, token } = useUser();

  const handleClick = () => {
    if (username === "") {
      lichessLogin();
    } else {
      void lichessLogout(dispatch, token)
        .then(() => void navigate("/"));
    }
  }

  return (
    <div className="d-flex flex-column align-items-center pt-4 pb-2">
      <img src="matepoint-logo.png" alt="MatePoint Academy logo"
        style={{ maxHeight: "140px", width: "auto" }} />
      <div className="h3 mp-brand-title mt-2 mb-0">
        MatePoint <span className="mp-brand-gold">ChessCam</span>
      </div>
      <div className="mp-subtitle mb-3">Academy Chess Club &middot; Carnoy</div>
      <button className="btn btn-dark btn-sm btn-outline-light" onClick={handleClick}>
        {username === "" ? "Login with Lichess" : `Logout from "${username}"`}
      </button>
    </div>
  );
}

export default Header;
