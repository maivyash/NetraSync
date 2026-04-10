/**
 * PlayFusionHoops — Full-screen game route for /play/fusion-hoops.
 *
 * Eye-tracking architecture (pure JS, no Python server):
 *   • useFaceCursor runs MediaPipe WASM in-browser
 *   • gazePosRef holds viewport-pixel gaze position
 *   • FusionHoops reads gazePosRef → determines if gaze is inside rim zone
 *   • Touch/click for shooting still works independently
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFaceCursorContext } from "../context/FaceCursorContext";
import FusionHoops from "../games/FusionHoops";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlayFusionHoops() {
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
      background: "rgba(5, 8, 16, 0.95)",
      backdropFilter: "blur(10px)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <EyeTrackingBadge />

      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        <FusionHoops onClose={handleClose} gazePosRef={gazePosRef} />
      </div>
    </div>
  );
}
