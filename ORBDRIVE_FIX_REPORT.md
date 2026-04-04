# OrbDrive Game Mechanics - Fix Report

## Issue Identified & Fixed

**Problem**: The game was ending automatically without allowing players to interact.

**Root Cause**: In the race loop, there was a problematic condition that would immediately end the race:

```javascript
// BEFORE (INCORRECT):
if (carEl && finishEl) {
  // ... proper finish line detection ...
  if (touchesFinishNow) { triggerWin(); }
  if (nextProgress >= 0.999 && at_finish) { triggerWin(); }
} else if (nextProgress >= 1) {
  // PROBLEM: This triggered if DOM refs were unavailable
  triggerWin();  // Race ended immediately!
}
```

This fallback condition was triggering when:
1. The car or finish line refs weren't immediately available (even temporarily), OR
2. Progress reached 1 without proper finish line detection

This caused the race to end before the player could even move the mouse to focus on the orb.

## Solution Applied

Removed the problematic fallback condition:

```javascript
// AFTER (CORRECT):
if (carEl && finishEl) {
  // ... proper finish line detection ...
  if (touchesFinishNow) { triggerWin(); }
  if (nextProgress >= 0.999 && at_finish) { triggerWin(); }
}
// No fallback - only ends when proper detection triggers
```

## Game Mechanics - How It Should Work

### Race Progression:
1. **Idle Phase**: Game starts, waiting for user interaction
2. **Mode Selection**: User chooses difficulty (Beginner/Intermediate/Advanced)
3. **Ready Confirmation**: User confirms they're ready
4. **Countdown**: 3-2-1-GO countdown begins
5. **Racing**: 
   - Race ONLY progresses when user is FOCUSED on the orb
   - Move mouse to the cyan orb in the left panel
   - Alignment must stay >= 45% to count as "focused"
   - Speed increases with focus strength
   - Car moves forward on the track
6. **Finish**: 
   - Race ends when car physically crosses finish line ✓
   - OR when progress reaches near-maximum with car at finish position ✓

### Focus Mechanics:
```
User's eye position (mouse) → Alignment %
├─ Distance to orb < 20px → Alignment stays high
├─ Must maintain 45%+ for 2-3+ seconds → Stability increases
├─ Stability reaches mode's holdSeconds → Full speed unlock
└─ Lost focus for 5s → Race resets (failure condition)
```

### Car Speed Calculation:
- **Base Speed**: 60 km/h (always)
- **Focus Speed Bonus**: Up to 160 km/h (added based on focus quality)
- **Max Speed**: 220 km/h
- **Hold Requirement**: Must focus continuously for mode's hold time to reach max speed

### Three Difficulty Modes:

**BEGINNER** (Easy)
- Orb Size: 58px
- Hold Time Required: 2.5 seconds
- Tunnel Speed: 0.65x base
- No depth effects
- Best for: Learning controls

**INTERMEDIATE** (Medium)
- Orb Size: 52px → 36px (shrinks over 24 seconds)
- Hold Time Required: 4.5 seconds
- Tunnel Speed: 1.0x base (accelerates slowly)
- Depth warping effect enabled
- Best for: Building skills

**ADVANCED** (Hard)
- Orb Size: 34px → 30px (shrinking)
- Hold Time Required: 7 seconds
- Tunnel Speed: 1.15x base (rapid acceleration)
- Depth warping + sudden directional shifts
- Best for: Mastering the game

## Race End Conditions

### Win (Complete Race)
- ✅ Car front edge touches finish line
- OR ✅ Progress reaches 99.9% and car is at finish position

### Fail (Restart)
- ❌ Alignment < 45% for 5+ consecutive seconds

## What Changed in Code

**File**: `src/games/OrbDrive.jsx`  
**Lines**: ~528  
**Change**: Removed the `else if (nextProgress >= 1)` fallback condition

This ensures:
1. Game respects proper finish line detection
2. Race doesn't end due to timing issues with DOM refs
3. Player has full time to interact with the game
4. Only ends when physically appropriate conditions are met

## Testing Instructions

1. Navigate to `http://localhost:5173/dashboard`
2. Find "🌀 Orb Drive" card
3. Click "▶ PLAY"
4. Select **BEGINNER** difficulty (easiest)
5. Click "Yes, Start"
6. Watch countdown
7. **Move your mouse to the cyan glowing orb in the left panel**
8. Keep it there to maintain focus
9. Drive the car across the finish line

## Expected Behavior After Fix

✅ Game should NOT end immediately  
✅ You should be able to move mouse to the orb  
✅ Orb should light up when you're focused  
✅ Car should accelerate and move forward  
✅ Game ends ONLY when you cross the finish line  
✅ Results screen shows your stats  

## Known Limitations

- Finish line detection requires visible DOM elements
- CSS car positioning must be accurate for physical detection
- 5-second focus loss resets game (intentional failure condition)

---

**Status**: ✅ Fixed and Ready to Test
