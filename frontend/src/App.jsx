import { useState, useEffect } from "react";
import Auth from "./components/Auth";
import Questionnaire from "./components/Questionnaire";

function App() {
  const [player, setPlayer] = useState(null);

  // Load player if saved
  useEffect(() => {
    const saved = localStorage.getItem("fintrex_player");
    if (saved) {
      setPlayer(JSON.parse(saved));
    }
  }, []);

  const handleSuccess = (user) => {
    setPlayer(user);
    localStorage.setItem("fintrex_player", JSON.stringify(user));
  };

  const handleLogout = () => {
    setPlayer(null);
    localStorage.removeItem("fintrex_player");
  };

  return (
    <>
      {!player ? (
        <Auth onSuccess={handleSuccess} />
      ) : (
        <Questionnaire player={player} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
