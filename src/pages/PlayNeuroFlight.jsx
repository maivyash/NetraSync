import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFaceCursorContext } from "../context/FaceCursorContext";
import SkyLockGame from "../games/SkyLockGame";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlayNeuroFlight() {
  const navigate = useNavigate();
  const { setActive, gazePosRef } = useFaceCursorContext();

  useEffect(() => {
    setActive(true);
    return () => setActive(false);
  }, [setActive]);

  const handleClose = () => navigate("/dashboard", { replace: true });

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "#0a1628",
      zIndex: 2000,
    }}>
      <EyeTrackingBadge />
      <SkyLockGame onClose={handleClose} gazePosRef={gazePosRef} />
    </div>
  );
}
