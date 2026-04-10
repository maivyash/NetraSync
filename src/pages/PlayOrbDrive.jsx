/**
 * PlayOrbDrive — Full-screen game route for /play/orb-drive.
 *
 * Eye-tracking architecture (pure JS, no Python server):
 *   • useFaceCursor runs MediaPipe WASM in-browser
 *   • gazePosRef holds viewport-pixel gaze position
 *   • OrbDrive reads gazePosRef → converts to panel-% → moves virtual cursor
 *   • Touch events on mobile still work independently
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFaceCursorContext } from "../context/FaceCursorContext";
import OrbDrive from "../games/OrbDrive";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlayOrbDrive() {
  const navigate = useNavigate();
  const { setActive, gazePosRef } = useFaceCursorContext();

  // Activate face cursor when this page mounts, deactivate on unmount
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
        <OrbDrive onClose={handleClose} gazePosRef={gazePosRef} />
      </div>
    </div>
  );
}
