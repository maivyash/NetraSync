/**
 * GamesGrid — Renders the therapy games section with heading + card grid.
 * Clicking PLAY navigates to the game's own route.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { games } from "../../data/dashboardData";
import GameCard from "./GameCard";

const PLAYABLE = new Set(["orb-drive", "fusion-hoops"]);

export default function GamesGrid() {
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);
  const [hoveredGame, setHoveredGame] = useState(null);

  const handlePlay = (gameId) => {
    if (PLAYABLE.has(gameId)) {
      navigate(`/play/${gameId}`);
    } else {
      alert(`${gameId} game coming soon!`);
    }
  };

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20
      }}>
        <h2 style={{
          fontFamily: "var(--font-heading)", fontSize: "1rem", letterSpacing: 1,
          color: "var(--text-primary)"
        }}>🎮 Therapy Games</h2>
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          {games.length} available
        </span>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
        gap: 16
      }}>
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            isActive={activeGame === g.id}
            isHovered={hoveredGame === g.id}
            onToggle={() => setActiveGame(g.id === activeGame ? null : g.id)}
            onHover={() => setHoveredGame(g.id)}
            onLeave={() => setHoveredGame(null)}
            onPlay={() => handlePlay(g.id)}
          />
        ))}
      </div>
    </div>
  );
}
