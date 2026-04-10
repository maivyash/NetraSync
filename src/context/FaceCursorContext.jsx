/**
 * FaceCursorContext — App-level provider for the pure-JS face cursor.
 *
 * Hosts a single useFaceCursor() instance shared across all game pages.
 * Mounts the hidden <video> element needed by the hook.
 *
 * Usage:
 *   <FaceCursorProvider>...</FaceCursorProvider>
 *
 *   // In any child component:
 *   const { status, gazePosRef, active, setActive } = useFaceCursorContext();
 */

import { createContext, useContext, useState, useRef } from "react";
import useFaceCursor from "../hooks/useFaceCursor";

const FaceCursorContext = createContext(null);

export function FaceCursorProvider({ children }) {
  const [active, setActive] = useState(false);
  const { status, gazePosRef, videoRef } = useFaceCursor(active);

  return (
    <FaceCursorContext.Provider value={{ status, gazePosRef, active, setActive }}>
      {/* Hidden <video> element — pixel-perfect placement off-screen */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          zIndex: -1,
        }}
      />
      {children}
    </FaceCursorContext.Provider>
  );
}

export function useFaceCursorContext() {
  const ctx = useContext(FaceCursorContext);
  if (!ctx) throw new Error("useFaceCursorContext must be used inside <FaceCursorProvider>");
  return ctx;
}

export default FaceCursorContext;
