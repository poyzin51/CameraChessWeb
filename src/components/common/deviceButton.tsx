import { useCallback, useEffect, useState } from "react";
import { MEDIA_CONSTRAINTS } from "../../utils/constants";

// Labels are only populated once camera permission has been granted, so we
// re-enumerate on every dropdown open and on devicechange events.
const deviceLabel = (device: MediaDeviceInfo, index: number): string => {
  const label = device.label.split("(")[0].trim();
  return label !== "" ? label : `Camera ${String(index + 1)}`;
};

const DeviceButton = ({ videoRef }: { videoRef: any }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [device, setDevice] = useState<MediaDeviceInfo | null>(null);

  const refreshDevices = useCallback(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((allDevices) => {
        setDevices(allDevices.filter(
          (d) => d.kind === "videoinput" && d.deviceId !== ""
        ));
      })
      .catch((err) => {
        console.error(`${err.name}: ${err.message}`);
      });
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
    };
  }, [refreshDevices]);

  const handleClick = async (newDevice: MediaDeviceInfo) => {
    if (device?.deviceId === newDevice.deviceId) {
      return;
    }

    setDevice(newDevice);

    const constraints: any = {
      ...MEDIA_CONSTRAINTS,
      video: { ...MEDIA_CONSTRAINTS.video, deviceId: { exact: newDevice.deviceId } }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoRef.current.srcObject = stream;
  };

  const selectedIndex = devices.findIndex((d) => d.deviceId === device?.deviceId);

  return (
    <div className="dropdown">
      <button className="btn btn-dark btn-sm btn-outline-light dropdown-toggle w-100"
        id="deviceButton" data-bs-toggle="dropdown" aria-expanded="false"
        onClick={refreshDevices}>
        {(device === null || selectedIndex === -1)
          ? "Select a Camera"
          : deviceLabel(device, selectedIndex)}
      </button>
      <ul className="dropdown-menu dropdown-menu-dark" aria-labelledby="deviceButton">
        {devices.length === 0 &&
          <li><span className="dropdown-item disabled">No camera found</span></li>
        }
        {devices.map((d, i) =>
          <li key={d.deviceId}>
            <button type="button"
              onClick={() => { void handleClick(d).catch(console.error); }}
              className={`dropdown-item${d.deviceId === device?.deviceId ? " active" : ""}`}>
              {deviceLabel(d, i)}
            </button>
          </li>
        )}
      </ul>
    </div>
  );
};

export default DeviceButton;
