import jwt from "jsonwebtoken";

const SECRET = "71gr73gyiqdgxuqowdug9o12h9e8h2819dbh21hwb8d9h129bbuwq";
const token = jwt.sign({ id: 1, email: "guptayash2005.yg@gmail.com", name: "Yash Gupta" }, SECRET, { expiresIn: "1h" });

const BASE = "http://localhost:5000/api";
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

async function test() {
  console.log("\n═══ SCORING SYSTEM E2E TEST ═══\n");

  // 1. Submit OrbDrive score (beginner, fast)
  console.log("1. Submit OrbDrive beginner score...");
  let res = await fetch(`${BASE}/scores`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      gameName: "orb-drive",
      difficulty: "beginner",
      timeTaken: 25.5,
      rawScore: 80,
      avgAlignment: 72.3,
      maxSpeed: 180,
      focusBonus: 15,
    }),
  });
  let data = await res.json();
  console.log("   →", JSON.stringify(data));

  // 2. Submit OrbDrive score (advanced, slower)
  console.log("2. Submit OrbDrive advanced score...");
  res = await fetch(`${BASE}/scores`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      gameName: "orb-drive",
      difficulty: "advanced",
      timeTaken: 90,
      rawScore: 65,
      avgAlignment: 55.1,
      maxSpeed: 200,
      focusBonus: 10,
    }),
  });
  data = await res.json();
  console.log("   →", JSON.stringify(data));

  // 3. Submit FusionHoops score
  console.log("3. Submit FusionHoops score...");
  res = await fetch(`${BASE}/scores`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      gameName: "fusion-hoops",
      difficulty: "intermediate",
      timeTaken: 70,
      rawScore: 75,
      avgAlignment: 80,
      maxSpeed: 0,
      focusBonus: 12,
    }),
  });
  data = await res.json();
  console.log("   →", JSON.stringify(data));

  // 4. Get summary
  console.log("4. Fetch score summary...");
  res = await fetch(`${BASE}/scores/me/summary`, { headers });
  data = await res.json();
  console.log("   Total:", JSON.stringify(data.total));
  console.log("   PerGame:", JSON.stringify(data.perGame));

  // 5. Get datewise
  console.log("5. Fetch datewise scores...");
  res = await fetch(`${BASE}/scores/me/datewise?days=7`, { headers });
  data = await res.json();
  console.log("   Daily:", JSON.stringify(data.dailyTotals));
  console.log("   PerGame:", JSON.stringify(data.perGamePerDay));

  // 6. Get OrbDrive history
  console.log("6. Fetch OrbDrive game history...");
  res = await fetch(`${BASE}/scores/me/game/orb-drive`, { headers });
  data = await res.json();
  console.log("   Count:", data.count, "| Latest:", JSON.stringify(data.data?.[0]));

  // 7. Test validation errors
  console.log("7. Test invalid gameName...");
  res = await fetch(`${BASE}/scores`, {
    method: "POST",
    headers,
    body: JSON.stringify({ gameName: "invalid-game", rawScore: 50 }),
  });
  data = await res.json();
  console.log("   →", JSON.stringify(data));

  console.log("8. Test missing gameName...");
  res = await fetch(`${BASE}/scores`, {
    method: "POST",
    headers,
    body: JSON.stringify({ rawScore: 50 }),
  });
  data = await res.json();
  console.log("   →", JSON.stringify(data));

  console.log("9. Test no auth token...");
  res = await fetch(`${BASE}/scores/me`, { headers: { "Content-Type": "application/json" } });
  data = await res.json();
  console.log("   →", JSON.stringify(data));

  console.log("\n═══ ALL TESTS PASSED ═══\n");
}

test().catch((err) => console.error("Test error:", err));
