/**
 * PlaySkyShotPro — Full-screen game route for /play/sky-shot-pro.
 *
 * Eye-tracking architecture (pure JS, no Python server):
 *   • useFaceCursor runs MediaPipe WASM in-browser
 *   • gazePosRef holds viewport-pixel gaze position
 *   • SkyShotPro reads gazePosRef for aiming the bow
 *   • Click/tap still fires the arrow independently
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFaceCursorContext } from "../context/FaceCursorContext";
import SkyShotPro from "../games/SkyShotPro";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlaySkyShotPro() {
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
        <SkyShotPro onClose={handleClose} gazePosRef={gazePosRef} />
      </div>
    </div>
  );
}
