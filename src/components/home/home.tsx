import Header from "./header";
import Socials from "./socials";
import NavButton from "./navButton";

const NAV_ITEMS = [
  { text: "Record", subtitle: "Track a live game from the camera", tokenRequired: false },
  { text: "Upload", subtitle: "Turn a recorded video into a PGN", tokenRequired: false },
  { text: "Broadcast", subtitle: "Stream the game to a Lichess round", tokenRequired: true },
  { text: "Play", subtitle: "Play your Lichess game on a real board", tokenRequired: true },
  { text: "Export", subtitle: "Review and save finished games", tokenRequired: true },
  { text: "FAQ", subtitle: "Setup tips and troubleshooting", tokenRequired: false }
];

const Home = () => {
  return (
    <div className="d-flex h-100 flex-column p-0 m-0 text-center text-white bg-dark overflow-auto">
      <Header />
      <div className="d-flex flex-grow-1 align-items-center justify-content-center px-3 py-2">
        <div className="row g-2 m-0 w-100" style={{ maxWidth: "620px" }}>
          {NAV_ITEMS.map((item) =>
            <div className="col-6" key={item.text}>
              <NavButton text={item.text} subtitle={item.subtitle}
                tokenRequired={item.tokenRequired} />
            </div>
          )}
        </div>
      </div>
      <div className="pb-3 pt-2">
        <Socials />
      </div>
    </div>
  );
};

export default Home;
