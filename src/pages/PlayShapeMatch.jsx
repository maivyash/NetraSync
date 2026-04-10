/**
 * PlayShapeMatch — Full-screen game route for /play/shape-match.
 *
 * Eye-tracking architecture (pure JS, no Python server):
 *   • useFaceCursor runs MediaPipe WASM in-browser
 *   • gazePosRef holds viewport-pixel gaze position
 *   • ShapeMatch reads gazePosRef for mousePos/dragPos
 *   • Touch grab/drop still works independently on mobile
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFaceCursorContext } from "../context/FaceCursorContext";
import ShapeMatch from "../games/ShapeMatch";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlayShapeMatch() {
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
        <ShapeMatch onClose={handleClose} gazePosRef={gazePosRef} />
      </div>
    </div>
  );
}
