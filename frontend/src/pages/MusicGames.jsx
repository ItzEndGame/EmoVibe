import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import MusicReflexGame from "../components/Games/MusicReflexGame";
import "./MusicGames.css";

const MusicGames = () => {
  const [selectedGame, setSelectedGame] = useState(null);
  const location = useLocation();

  // When navigated here from MainApp (via the "Play Beat Reflex" link),
  // the current recommendations + detected emotion are passed through
  // router state so the game has real tracks to play, instead of a
  // hardcoded list. If the user opens /app/games directly (no state), the
  // game component falls back to fetching the user's liked songs itself.
  const passedTracks = location.state?.tracks || [];
  const passedEmotion = location.state?.emotion || "neutral";

  const games = [
    {
      name: "Reflex Beats",
      emoji: "🎯",
      description: "Tap the beats before they fade — paced to your mood.",
      component: <MusicReflexGame tracks={passedTracks} currentEmotion={passedEmotion} />,
    },
    // Future: Add more like Music Quiz, Mood Match, etc.
  ];

  return (
    <>
      <header className="games-header">
        <div>
          <h1>Music Games</h1>
          <p>Test your rhythm and reflex, paced to your mood.</p>
        </div>
        {selectedGame && (
          <button className="games-back-btn" onClick={() => setSelectedGame(null)}>
            ⬅ Back to Games
          </button>
        )}
      </header>

      {!selectedGame ? (
        <div className="games-grid">
          {games.map((game) => (
            <div
              key={game.name}
              className="games-card"
              onClick={() => setSelectedGame(game.name)}
            >
              <div className="games-card-icon">{game.emoji}</div>
              <h3>{game.name}</h3>
              <p>{game.description}</p>
            </div>
          ))}
        </div>
      ) : (
        games.find((g) => g.name === selectedGame)?.component
      )}
    </>
  );
};

export default MusicGames;