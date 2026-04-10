/**
 * useEyeCursor — Backward-compatibility shim.
 *
 * The actual face tracking is now done by useFaceCursor (pure JS/WASM),
 * accessed via FaceCursorContext. This shim reads from the context so
 * any legacy code that imported useEyeCursor still works.
 *
 * The `active` param now calls context.setActive() instead of opening
 * a WebSocket to face_cursor.py.
 */

import { useEffect } from "react";
import { useFaceCursorContext } from "../context/FaceCursorContext";

export default function useEyeCursor(active = false) {
  const { status, setActive } = useFaceCursorContext();

  useEffect(() => {
    setActive(active);
    return () => {
      // Don't turn off on cleanup — other games may also be active
      // The play pages will explicitly call setActive(false) on unmount
    };
  }, [active, setActive]);

  return { status };
}
