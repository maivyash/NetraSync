/**
 * PlayShapeMatch — Full-screen game route for /play/shape-match.
 *
 * Eye-tracking architecture:
 *   • face_cursor.py moves the OS cursor using face tracking.
 *   • The game reads normal mouse events globally to capture movements.
 *   • useEyeCursor sends start/stop commands to face_cursor.py.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useEyeCursor from "../hooks/useEyeCursor";
import ShapeMatch from "../games/ShapeMatch";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlayShapeMatch() {
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);

  // Connect to face_cursor.py — it controls the OS cursor directly
  const { status } = useEyeCursor(true);

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
      <EyeTrackingBadge status={status} />

      <div style={{
        position: "absolute", inset: 0, display: "flex",
      }}>
        <ShapeMatch onClose={handleClose} onRunningChange={setIsRunning} />
      </div>
    </div>
  );
}
