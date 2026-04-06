/**
 * Static data constants for the Dashboard page.
 * Kept separate so Dashboard.jsx stays focused on layout and logic.
 */

export const games = [
  {
    id: "orb-drive", icon: "🌀", title: "Orb Drive",
    type: "Convergence Training", progress: 72, xp: 1240,
    color: "#00f5ff", difficulty: "Medium",
    desc: "Track the converging orb patterns to strengthen binocular fusion.",
  },
  {
    id: "focus-shift", icon: "🎯", title: "Focus Shift",
    type: "Focus Control", progress: 48, xp: 860,
    color: "#a855f7", difficulty: "Hard",
    desc: "Rapid near-to-far focus transitions that build accommodative flexibility.",
  },
  {
    id: "fusion-hoops", icon: "🏀", title: "Fusion Hoops",
    type: "Eye-Convergence Sports", progress: 45, xp: 1520,
    color: "#a855f7", difficulty: "Medium",
    desc: "Eye convergence basketball training using focus stability to make precision shots.",
  },
  {
    id: "depth-arena", icon: "🎲", title: "Depth Arena",
    type: "Stereopsis Training", progress: 34, xp: 420,
    color: "#ff6b35", difficulty: "Hard",
    desc: "3D depth perception challenges that rebuild stereoscopic vision quickly.",
  },
  {
    id: "contrast-wars", icon: "⚡", title: "Contrast Wars",
    type: "Contrast Sensitivity", progress: 61, xp: 970,
    color: "#f59e0b", difficulty: "Medium",
    desc: "Low-contrast stimuli battles that sharpen visual sensitivity thresholds.",
  },
  {
    id: "perimeter-run", icon: "🏃", title: "Perimeter Run",
    type: "Visual Field", progress: 18, xp: 200,
    color: "#ec4899", difficulty: "Easy",
    desc: "Peripheral awareness drills that expand visual field detection range.",
  },
];

export const metrics = [
  { label: "Visual Acuity", value: 78, unit: "%", color: "#00f5ff", icon: "👁" },
  { label: "Convergence", value: 64, unit: "%", color: "#a855f7", icon: "🔄" },
  { label: "Contrast Sensitivity", value: 85, unit: "%", color: "#00ff88", icon: "⚡" },
  { label: "Field Coverage", value: 52, unit: "%", color: "#ff6b35", icon: "🗺️" },
];

export const weekData = [40, 55, 48, 70, 65, 82, 78];
export const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const clinicalItems = [
  { label: "Overall Vision Improvement", pct: 65, color: "#00f5ff" },
  { label: "Sessions Completed", pct: 78, color: "#a855f7" },
  { label: "Therapy Compliance", pct: 92, color: "#00ff88" },
  { label: "Doctor Rating", pct: 88, color: "#f59e0b" },
];
