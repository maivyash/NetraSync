/**
 * Static data constants for the Dashboard page.
 * Kept separate so Dashboard.jsx stays focused on layout and logic.
 */

const allGames = [
  {
    id: "orb-drive", icon: "🌀", title: "Orb Drive",
    type: "Convergence Training", progress: 72, xp: 1240,
    color: "#00f5ff", difficulty: "Medium",
    desc: "Track the converging orb patterns to strengthen binocular fusion.",
    instructions: [
      "Choose a mode first (Beginner, Intermediate, or Advanced) before starting the race.",
      "Keep your cursor aligned with the moving orb inside the TRACK THE ORB panel.",
      "Build FOCUS LOCK by holding stable alignment; full lock unlocks top speed.",
      "If alignment drops too low for too long, speed is penalized and warning mode appears.",
      "In harder modes, expect sudden orb shifts and faster tunnel acceleration.",
      "Complete the track quickly while maintaining high alignment, focus, and max speed.",
    ],
  },

  {
    id: "fusion-hoops", icon: "🏀", title: "Fusion Hoops",
    type: "Eye-Convergence Sports", progress: 45, xp: 1520,
    color: "#a855f7", difficulty: "Medium",
    desc: "Eye convergence basketball training using focus stability to make precision shots.",
    instructions: [
      "Start the session and keep your cursor focused near the rim to build fusion hold.",
      "Watch the FUSION/HOLD meters; longer stable hold gives stronger shot outcomes.",
      "Tap/click to shoot only after building enough hold for a perfect or close shot.",
      "Each cycle has 4 attempts, and the game progresses through three court levels.",
      "Perfect shots require full hold, close shots give scaled points, misses reset rhythm.",
      "Finish all attempts before the timer ends to maximize score and accuracy.",
    ],
  },

  {
    id: "sky-shot-pro", icon: "🏹", title: "Sky Shot Pro",
    type: "Eye-Hand Coordination", progress: 0, xp: 0,
    color: "#1a8fff", difficulty: "Medium",
    desc: "Precision archery training — track moving targets and fire arrows to sharpen eye-hand coordination.",
    instructions: [
      "Choose START CHALLENGE to begin the archery session.",
      "Targets oscillate up and down independently — track their movement carefully.",
      "Click directly ON a moving target to shoot an arrow from the bow.",
      "Watch the arrow fly toward the target; accurate hits earn points.",
      "Quick consecutive hits build COMBOS for score multipliers.",
      "Complete all targets before the timer runs out to advance to the next level.",
    ],
  },
  {
    id: "neuroflight", icon: "✈️", title: "NeuroFlight",
    type: "Aviation Therapy", progress: 0, xp: 0,
    color: "#00c8ff", difficulty: "Medium",
    desc: "A 3D aviation game to treat Amblyopia and eye misalignment using clinical techniques.",
    instructions: [
      "Act as a pilot to transport passengers safely through obstacles.",
      "Maintain clear alignment to keep the plane centered and stable.",
      "Force your brain to use both eyes via dichoptic viewing signals.",
      "Track incoming hazards to improve smooth pursuit and saccadic movements.",
      "Complete the mission without stressing out your passengers with collisions.",
    ],
  },
];

// Ensure NeuroFlight is listed first, then the others
const orbDrive = allGames.find(g => g.id === "orb-drive");
const fusionHoops = allGames.find(g => g.id === "fusion-hoops");
const skyShotPro = allGames.find(g => g.id === "sky-shot-pro");
const neuroFlight = allGames.find(g => g.id === "neuroflight");

export const games = [neuroFlight, orbDrive, fusionHoops, skyShotPro];

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
