import React, { useEffect, useState, useRef } from "react";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const shuffleArray = (arr) => {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const QUIZ_DURATION_SECONDS = 360;

const Questionnaire = ({ player, onLogout }) => {
  const MySwal = withReactContent(Swal);
  const timerRef = useRef(null);

  // Block if no player (unauthorized attempt)
  useEffect(() => {
    if (!player) {
      onLogout();
    }
  }, [player, onLogout]);

  const STORAGE_KEY = `fintrex_quiz_${player?.nic}`;

  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showStart, setShowStart] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION_SECONDS);
  const [quizEnded, setQuizEnded] = useState(false);
  const [quizStartTimestamp, setQuizStartTimestamp] = useState(null);

  const [selectedOption, setSelectedOption] = useState(null);
  const [answersGiven, setAnswersGiven] = useState([]);

  // Load questions
  useEffect(() => {
    fetch("/assets/questionnaire.json")
      .then((res) => res.json())
      .then((data) => {
        setAllQuestions(data);
        setLoading(false);
      })
      .catch(() => {
        MySwal.fire({
          icon: "error",
          title: "Uh-oh!",
          text: "Couldn't load questions. Try again later.",
        });
      });
  }, []);

  // Restore state from localStorage if exists
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (!parsed.quizEnded && parsed.questions?.length > 0) {
          setQuestions(parsed.questions);
          setCurrentIndex(parsed.currentIndex || 0);
          setScore(parsed.score || 0);
          setShowStart(false);
          setQuizEnded(false);
          setQuizStartTimestamp(parsed.quizStartTimestamp || Date.now());
          setTimeLeft(parsed.timeLeft || QUIZ_DURATION_SECONDS);
          setAnswersGiven(parsed.answersGiven || []);
          setSelectedOption(parsed.selectedOption || null);
        } else if (parsed.quizEnded) {
          handleLogout();
        }
      } catch {
        console.error("Failed to restore quiz state");
      }
    }
  }, [STORAGE_KEY]);

  // Save state to localStorage
  useEffect(() => {
    if (!quizEnded) {
      const stateToSave = {
        questions,
        currentIndex,
        score,
        showStart,
        quizEnded,
        quizStartTimestamp,
        timeLeft,
        answersGiven,
        selectedOption,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [
    questions,
    currentIndex,
    score,
    showStart,
    quizEnded,
    quizStartTimestamp,
    timeLeft,
    answersGiven,
    selectedOption,
    STORAGE_KEY,
  ]);

  // Timer
  useEffect(() => {
    if (showStart || quizEnded) return;
    if (!quizStartTimestamp) return;

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - quizStartTimestamp) / 1000);
      const remaining = QUIZ_DURATION_SECONDS - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(timerRef.current);
        MySwal.fire({
          icon: "warning",
          title: "Time's up!",
          text: "Your time has run out.",
        }).then(() => setQuizEnded(true));
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => clearInterval(timerRef.current);
  }, [quizStartTimestamp, showStart, quizEnded]);

  // Save result to backend once finished
  useEffect(() => {
    if (quizEnded && player) {
      fetch("https://fintrexquiz.onrender.com/api/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nic: player.nic, score }),
      }).catch((err) => {
        console.error("Save failed", err);
      });
    }
  }, [quizEnded, player, score]);

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("fintrex_player");
    if (onLogout) onLogout();
  };

  // Submit answer
  const submitAnswer = () => {
    if (quizEnded || selectedOption === null) return;

    const currentQ = questions[currentIndex];
    const isCorrect = selectedOption === currentQ.answer;

    setAnswersGiven((prev) => [
      ...prev,
      { question: currentQ.question, selected: selectedOption, correct: currentQ.answer },
    ]);

    if (isCorrect) setScore((s) => s + 1);

    MySwal.fire({
      title: isCorrect ? "Correct!" : "Wrong!",
      imageUrl: isCorrect ? "/assets/correct1.jpg" : "/assets/wrong1.jpg",
      imageHeight: 300,
      confirmButtonText: "Continue",
    }).then(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        setQuizEnded(true);
      } else {
        setCurrentIndex(nextIndex);
        setSelectedOption(null);
      }
    });
  };

  const startQuiz = () => {
    const now = Date.now();
    const selected = shuffleArray(allQuestions).slice(0, 10);
    const shuffledQuestions = selected.map((q) => ({
      question: q.question,
      options: shuffleArray(q.options),
      answer: q.answer,
    }));

    setQuestions(shuffledQuestions);
    setCurrentIndex(0);
    setScore(0);
    setQuizEnded(false);
    setQuizStartTimestamp(now);
    setTimeLeft(QUIZ_DURATION_SECONDS);
    setSelectedOption(null);
    setAnswersGiven([]);
    setShowStart(false);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // ---- UI ----

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-purple-800 text-white">
        <p className="text-xl">Loading quiz...</p>
      </div>
    );
  }

  // End screen
  if (quizEnded) {
    const isWinner = score >= 7; // ✅ Win if 7 or above
    const finalImg = isWinner ? "/assets/won.jpg" : "/assets/lost.jpg";
    const finalTitle = isWinner ? "🎉 Congratulations, You WON!" : "😢 Better luck next time!";
    const finalMsg = `You scored ${score} / ${questions.length}.`;

    return (
      <div className="min-h-screen bg-purple-800 text-white p-6">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src={finalImg} alt="Result" className="w-80 max-w-full mb-4 rounded-lg shadow-xl" />
          <h2 className="text-3xl mb-2">{finalTitle}</h2>
          <p className="text-2xl mb-10">{finalMsg}</p>
        </div>

        <h2 className="text-2xl mb-4 text-center">Review Your Answers</h2>
        <div className="max-w-3xl mx-auto space-y-4 mb-8">
          {answersGiven.map(({ question, selected, correct }, i) => {
            const correctAns = selected === correct;
            return (
              <div
                key={i}
                className={`p-4 rounded-lg shadow-md ${
                  correctAns ? "bg-green-700" : "bg-red-700"
                }`}
              >
                <h2 className="text-lg mb-1">{`Q${i + 1}: ${question}`}</h2>
                <p>
                  Your answer: <span className="font-semibold">{selected}</span>
                </p>
                {!correctAns && (
                  <p>
                    Correct answer: <span className="font-semibold">{correct}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 px-6 py-3 rounded-lg text-white font-bold"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  // Start screen
  if (showStart) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-purple-800 text-white text-center px-6">
        <img src="/assets/logo.png" alt="Fintrex Logo" className="w-32 sm:w-40 mb-6 drop-shadow-lg" />
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-2">Fintrex Finance</h1>
        <h2 className="text-2xl sm:text-3xl font-semibold mb-8">Customer Service Week</h2>
        <img src="/assets/menu.jpg" alt="Intro" className="w-100 sm:w-100 mb-10 rounded-lg shadow-lg" />
        <button
          onClick={startQuiz}
          className="bg-lime-400 hover:bg-lime-500 px-10 py-4 rounded text-white text-2xl font-bold shadow-sm transition"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  // Quiz screen
  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-purple-800 text-white flex flex-col items-center justify-center px-4 py-8 relative">
      <div className="w-full max-w-xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-5 text-lg font-semibold">
          <span>
            Question {currentIndex + 1} / {questions.length}
          </span>
          <span>Time Left: {formatTime(timeLeft)}</span>
        </div>

        <div className="bg-purple-700 p-6 rounded-xl shadow-md">
          <h2 className="text-xl sm:text-2xl mb-6">{currentQ.question}</h2>
          <div className="grid gap-3 mb-6">
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedOption(opt)}
                  className={`p-4 rounded-lg text-left w-full shadow-sm transition
                    ${isSelected ? "bg-lime-500" : "bg-lime-700 hover:bg-lime-500"}
                  `}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <button
            onClick={submitAnswer}
            disabled={selectedOption === null}
            className={`w-full py-3 rounded-lg font-bold text-xl
              ${selectedOption === null ? "bg-gray-500 cursor-not-allowed" : "bg-lime-400 hover:bg-lime-500"}
            `}
          >
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
