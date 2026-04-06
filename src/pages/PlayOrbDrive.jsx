/**
 * PlayOrbDrive — Full-screen game route for /play/orb-drive.
 * Activates the eye-tracking pupil cursor and renders the OrbDrive game.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useEyeCursor from "../hooks/useEyeCursor";
import OrbDrive from "../games/OrbDrive";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";
import EyeCursorOverlay from "../components/eye-tracking/EyeCursorOverlay";

export default function PlayOrbDrive() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  // Keep camera connected so it warms up, but only use the eye cursor when game starts
  const { gazePos, gazePosRef, status } = useEyeCursor(true);

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
      cursor: isRunning ? "none" : "auto",
    }}>
      <EyeTrackingBadge status={status} />
      {isRunning && status === "active" && <EyeCursorOverlay gazePos={gazePos} />}

      <div style={{
        position: "absolute", inset: 0, display: "flex", cursor: isRunning ? "none" : "auto",
      }}>
        <OrbDrive onClose={handleClose} gazePosRef={gazePosRef} onRunningChange={setIsRunning} />
      </div>
    </div>
  );
}
