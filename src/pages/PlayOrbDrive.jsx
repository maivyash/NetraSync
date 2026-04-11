/**
 * PlayOrbDrive — Full-screen game route /play/orb-drive
 * Landscape-first layout — face cursor active while on this page.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFaceCursorContext } from "../context/FaceCursorContext";
import OrbDrive from "../games/OrbDrive";
import EyeTrackingBadge from "../components/eye-tracking/EyeTrackingBadge";

export default function PlayOrbDrive() {
  const navigate = useNavigate();
  const { setActive, gazePosRef } = useFaceCursorContext();

  useEffect(() => {
    setActive(true);
    // Prevent body scroll/bounce while game is open
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return () => {
      setActive(false);
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [setActive]);

  const handleClose = () => navigate("/dashboard", { replace: true });

  return (
    <div
      className="game-fullscreen"
      style={{ background: "rgba(5,8,16,0.98)", touchAction: "none" }}
    >
      <EyeTrackingBadge />
      <OrbDrive onClose={handleClose} gazePosRef={gazePosRef} />
    </div>
  );
}
