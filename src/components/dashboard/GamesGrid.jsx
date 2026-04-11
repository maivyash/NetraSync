/**
 * GamesGrid — Renders the therapy games section with heading + card grid.
 * Clicking PLAY navigates to the game's own route.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { games } from "../../data/dashboardData";
import GameCard from "./GameCard";
import { CloseOutlined } from "@ant-design/icons";
import { getScoreSummary } from "../../utils/scoreApi";

const PLAYABLE = new Set(["orb-drive", "fusion-hoops", "sky-shot-pro", "neuroflight"]);

export default function GamesGrid() {
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);
  const [hoveredGame, setHoveredGame] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [gamePoints, setGamePoints] = useState({});

  useEffect(() => {
    // Fetch score summary and aggregate points per game
    getScoreSummary().then(res => {
      if (res && res.success && res.perGame) {
        const pointsMap = {};
        res.perGame.forEach(g => {
          pointsMap[g.gameName] = (pointsMap[g.gameName] || 0) + g.totalPoints;
        });
        setGamePoints(pointsMap);
      }
    }).catch(err => console.error("Error fetching score summary:", err));
  }, []);

  const handlePlay = (gameId) => {
    if (PLAYABLE.has(gameId)) {
      navigate(`/play/${gameId}`);
    } else {
      alert(`${gameId} game coming soon!`);
    }
  };

  const openInstructions = (game) => {
    setSelectedGame(game);
    setShowInstructions(true);
  };

  const closeInstructions = () => {
    setShowInstructions(false);
    setSelectedGame(null);
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
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 20,
        '@media (min-width: 768px)': {
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        },
        '@media (min-width: 1024px)': {
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))"
        },
        '@media (min-width: 1440px)': {
          gridTemplateColumns: "repeat(3, 1fr)"
        }
      }}>
        {games.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            earnedPoints={gamePoints[g.id] || 0}
            isActive={activeGame === g.id}
            isHovered={hoveredGame === g.id}
            onToggle={() => setActiveGame(g.id === activeGame ? null : g.id)}
            onHover={() => setHoveredGame(g.id)}
            onLeave={() => setHoveredGame(null)}
            onInstructions={() => openInstructions(g)}
            onPlay={() => handlePlay(g.id)}
          />
        ))}
      </div>

      {showInstructions && selectedGame && (
        <>
          <div
            onClick={closeInstructions}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(3px)",
              zIndex: 300,
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 301,
              width: "min(560px, calc(100% - 32px))",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "linear-gradient(150deg, rgba(6,12,20,0.98), rgba(9,18,30,0.98))",
              border: "1px solid rgba(0,245,255,0.3)",
              borderRadius: 14,
              boxShadow: "0 18px 48px rgba(0,0,0,0.4)",
              padding: "18px 18px 16px",
            }}
          >
            <button
              onClick={closeInstructions}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "1px solid rgba(0,245,255,0.25)",
                background: "rgba(0,245,255,0.08)",
                color: "#00f5ff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close instructions"
            >
              <CloseOutlined />
            </button>

            <h3
              style={{
                margin: "2px 28px 10px 0",
                color: "#00f5ff",
                fontFamily: "var(--font-heading)",
                fontSize: "1rem",
                letterSpacing: 0.6,
              }}
            >
              {selectedGame.title} Instructions
            </h3>

            <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", lineHeight: 1.55, marginBottom: 10 }}>
              {selectedGame.type} guidelines for focused, safe, and effective training.
            </p>

            <ol
              style={{
                margin: 0,
                paddingLeft: 18,
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                lineHeight: 1.65,
              }}
            >
              {selectedGame.instructions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
