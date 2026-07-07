import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import MusicReflexGame from "../components/Games/MusicReflexGame";

const MusicGames = () => {
  const [selectedGame, setSelectedGame] = useState(null);
  const location = useLocation();

  // When navigated here from MainApp (via the "Play Beat Reflex" link),
  // the current recommendations + detected emotion are passed through
  // router state so the game has real tracks to play, instead of a
  // hardcoded list. If the user opens /games directly (no state), the
  // game component falls back to fetching the user's liked songs itself.
  const passedTracks = location.state?.tracks || [];
  const passedEmotion = location.state?.emotion || "neutral";

  const games = [
    {
      name: "Reflex Beats",
      component: <MusicReflexGame tracks={passedTracks} currentEmotion={passedEmotion} />,
    },
    // Future: Add more like Music Quiz, Mood Match, etc.
  ];

  return (
    <div
      style={{
        color: "white",
        textAlign: "center",
        padding: "40px",
        minHeight: "100vh",
        background: "linear-gradient(135deg, rgba(20,20,40,0.9), rgba(50,30,80,0.9))",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", marginBottom: "30px" }}>🎵 Music Games</h1>

      {!selectedGame ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            flexWrap: "wrap",
          }}
        >
          {games.map((game) => (
            <div
              key={game.name}
              onClick={() => setSelectedGame(game.name)}
              style={{
                width: "250px",
                padding: "20px",
                borderRadius: "20px",
                background: "rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "0.3s",
              }}
            >
              <h3>{game.name}</h3>
              <p>Test your rhythm & reflex!</p>
            </div>
          ))}
        </div>
      ) : (
        <>
          <button
            onClick={() => setSelectedGame(null)}
            style={{
              padding: "10px 20px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: "10px",
              border: "none",
              color: "white",
              cursor: "pointer",
              marginBottom: "20px",
            }}
          >
            ⬅ Back to Games
          </button>
          {games.find((g) => g.name === selectedGame)?.component}
        </>
      )}
    </div>
  );
};

export default MusicGames;