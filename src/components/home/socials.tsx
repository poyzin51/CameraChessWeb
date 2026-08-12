import { SocialIcon } from 'react-social-icons/component'
import 'react-social-icons/youtube'
import 'react-social-icons/github'

const socials = [
  { "network": "github", "url": "https://github.com/Pbatch/CameraChessWeb", "bgColor": "#111111" },
  { "network": "youtube", "url": "https://www.youtube.com/channel/UCtgc3RevHj6UHq1D8Ymarmw" },
]

const Socials = () => {
  return (
    <div className="d-flex justify-content-center align-items-center gap-3">
      {socials.map((social) =>
        <SocialIcon key={social.network} target="_blank" style={{ height: 34, width: 34 }}
          network={social.network} url={social.url} bgColor={social.bgColor} />
      )}
    </div>
  );
};

export default Socials;
