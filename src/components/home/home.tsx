import Header from "./header";
import Socials from "./socials";
import NavButton from "./navButton";

const Home = () => {
  return (
    <div className="container-flex d-flex overflow-hidden h-100 flex-column p-0 m-0 text-center text-white bg-dark">
      <Header />
      <div className="mx-auto w-100 px-3" style={{ maxWidth: "560px" }}>
        <div className="row g-2 m-2">
          <div className="col-6">
            <NavButton text="Record" tokenRequired={false} />
          </div>
          <div className="col-6">
            <NavButton text="Upload" tokenRequired={false} />
          </div>
          <div className="col-6">
            <NavButton text="Broadcast" tokenRequired={true} />
          </div>
          <div className="col-6">
            <NavButton text="Play" tokenRequired={true} />
          </div>
          <div className="col-6">
            <NavButton text="Export" tokenRequired={true} />
          </div>
          <div className="col-6">
            <NavButton text="FAQ" tokenRequired={false} />
          </div>
        </div>
      </div>
      <div className="row my-2 mx-0 mt-auto">
        <Socials />
      </div>
    </div>
  );
};

export default Home;
