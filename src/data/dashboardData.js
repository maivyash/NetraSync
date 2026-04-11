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
    id: "focus-shift", icon: "🎯", title: "Focus Shift",
    type: "Focus Control", progress: 48, xp: 860,
    color: "#a855f7", difficulty: "Hard",
    desc: "Rapid near-to-far focus transitions that build accommodative flexibility.",
    instructions: [
      "This module trains near-to-far focus transitions with timed visual targets.",
      "Shift focus immediately when the active target changes depth or distance.",
      "Avoid over-correcting head movement; use smooth eye-led transitions.",
      "Keep transitions quick but accurate to preserve combo and score multipliers.",
      "If blur persists, pause briefly, blink-reset, and continue with controlled focus.",
      "Complete all transition rounds to maximize flexibility and session score.",
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
    id: "depth-arena", icon: "🎲", title: "Depth Arena",
    type: "Stereopsis Training", progress: 34, xp: 420,
    color: "#ff6b35", difficulty: "Hard",
    desc: "3D depth perception challenges that rebuild stereoscopic vision quickly.",
    instructions: [
      "This module targets stereo depth judgment across layered 3D cues.",
      "Select the object that appears closest or farthest based on each prompt.",
      "Use steady binocular focus and avoid chasing background motion artifacts.",
      "Prioritize depth accuracy first, then improve response speed gradually.",
      "Recalibrate your gaze center between rounds if double vision appears.",
      "Complete all challenge waves to improve stereopsis consistency.",
    ],
  },
  {
    id: "contrast-wars", icon: "⚡", title: "Contrast Wars",
    type: "Contrast Sensitivity", progress: 61, xp: 970,
    color: "#f59e0b", difficulty: "Medium",
    desc: "Low-contrast stimuli battles that sharpen visual sensitivity thresholds.",
    instructions: [
      "Detect low-contrast targets as early as possible in each visual burst.",
      "Maintain central fixation while scanning peripheral contrast changes.",
      "Respond only when target edges are clearly detected to avoid false hits.",
      "As levels advance, contrast drops and presentation speed increases.",
      "Use controlled blinking between rounds to reduce visual fatigue.",
      "Finish all rounds to track your current contrast threshold reliably.",
    ],
  },
  {
    id: "perimeter-run", icon: "🏃", title: "Perimeter Run",
    type: "Visual Field", progress: 18, xp: 200,
    color: "#ec4899", difficulty: "Easy",
    desc: "Peripheral awareness drills that expand visual field detection range.",
    instructions: [
      "Keep your gaze centered while reacting to edge/peripheral visual cues.",
      "Do not move the cursor randomly; respond only to valid side stimuli.",
      "Alternate left-right detection quickly while maintaining center stability.",
      "Missed edge cues reduce streak, so balance speed with control.",
      "Increase tolerance gradually if you feel eye strain in outer-field drills.",
      "Complete the full run to improve peripheral detection coverage.",
    ],
  },
  {
    id: "shape-match", icon: "🧩", title: "Shape Match",
    type: "Visual Motor Integration", progress: 0, xp: 0,
    color: "#00ff88", difficulty: "Beginner",
    desc: "Drag and drop solid objects into their corresponding outlines to build spatial targeting.",
    instructions: [
      "Pick a difficulty mode first; each mode changes shape count, size, and tolerance.",
      "Grab the shape from SOURCE and drag it precisely to the TARGET AREA.",
      "Release/drop when the shape center is inside the allowed target radius.",
      "Complete the required sequence without unnecessary cursor drift.",
      "Faster accurate matches improve final score and best-time tracking.",
      "If a drop misses, re-grab quickly and re-align before attempting again.",
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

// Extract the required top games
const orbDrive = allGames.find(g => g.id === "orb-drive");
const fusionHoops = allGames.find(g => g.id === "fusion-hoops");
const skyShotPro = allGames.find(g => g.id === "sky-shot-pro");
const neuroFlight = allGames.find(g => g.id === "neuroflight");

// Extract remaining games and shuffle them
let others = allGames.filter(g => 
  g.id !== "orb-drive" && 
  g.id !== "fusion-hoops" && 
  g.id !== "sky-shot-pro" && 
  g.id !== "neuroflight"
);
others.sort(() => Math.random() - 0.5);

// The final active game order
export const games = [neuroFlight, orbDrive, fusionHoops, skyShotPro, ...others];

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
