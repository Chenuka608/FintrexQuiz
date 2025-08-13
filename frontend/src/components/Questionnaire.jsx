import React, { useEffect, useState, useRef } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const shuffleArray = (arr) => {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const STORAGE_KEY = 'fintrex_quiz_state';
const QUIZ_DURATION_SECONDS = 360;

const Questionnaire = () => {
  const MySwal = withReactContent(Swal);
  const restoredFromStorage = useRef(false);
  const timerRef = useRef(null);

  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showStart, setShowStart] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timeUpHandled, setTimeUpHandled] = useState(false);
  const [quizEnded, setQuizEnded] = useState(false);
  const [quizStartTimestamp, setQuizStartTimestamp] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION_SECONDS);

  const [selectedOption, setSelectedOption] = useState(null);
  const [answersGiven, setAnswersGiven] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setQuestions(parsed.questions || []);
        setCurrentIndex(parsed.currentIndex || 0);
        setScore(parsed.score || 0);
        setShowStart(parsed.showStart ?? true);
        setTimeUpHandled(parsed.timeUpHandled ?? false);
        setQuizEnded(parsed.quizEnded ?? false);
        setQuizStartTimestamp(parsed.quizStartTimestamp || null);
        setAnswersGiven(parsed.answersGiven || []);
        setSelectedOption(parsed.selectedOption || null);
        restoredFromStorage.current = true;
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      const stateToSave = {
        questions,
        currentIndex,
        score,
        showStart,
        timeUpHandled,
        quizEnded,
        quizStartTimestamp,
        answersGiven,
        selectedOption,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    }
  }, [questions, currentIndex, score, showStart, timeUpHandled, quizEnded, quizStartTimestamp, answersGiven, selectedOption, loading]);

  useEffect(() => {
    fetch('/assets/questionnaire.json')
      .then(res => res.json())
      .then(data => {
        setAllQuestions(data);
        setLoading(false);
        if (!restoredFromStorage.current) {
          setShowStart(true);
        }
      })
      .catch(() => {
        MySwal.fire({
          icon: 'error',
          title: 'Uh-oh!',
          text: "Couldn't load Finny's questions. Try again later.",
        });
      });
  }, []);

  useEffect(() => {
    if (showStart || quizEnded) return;

    if (!quizStartTimestamp) {
      const now = Date.now();
      setQuizStartTimestamp(now);
      setTimeLeft(QUIZ_DURATION_SECONDS);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - quizStartTimestamp) / 1000);
      const remaining = QUIZ_DURATION_SECONDS - elapsed;

      if (remaining <= 0) {
        setTimeLeft(0);
        if (!timeUpHandled) {
          setTimeUpHandled(true);
          timerRef.current && clearInterval(timerRef.current);
          MySwal.fire({
            icon: 'warning',
            title: "Time's up!",
            text: 'Your time has run out. Check your results.',
            confirmButtonText: 'See Score',
          }).then(() => setQuizEnded(true));
        }
      } else {
        setTimeLeft(remaining);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => clearInterval(timerRef.current);
  }, [quizStartTimestamp, showStart, quizEnded, timeUpHandled]);

  useEffect(() => {
    if (quizEnded) {
      timerRef.current && clearInterval(timerRef.current);
    }
  }, [quizEnded]);

  const submitAnswer = () => {
    if (quizEnded || timeLeft <= 0 || selectedOption === null) return;

    const currentQ = questions[currentIndex];
    const isCorrect = selectedOption === currentQ.answer;

    setAnswersGiven(prev => [...prev, {
      question: currentQ.question,
      selected: selectedOption,
      correct: currentQ.answer,
    }]);

    if (isCorrect) setScore(s => s + 1);

    const folder = isCorrect ? 'successImgs' : 'failImgs';
    const imgs = isCorrect
      ? ['bank.png', 'happy.png', 'money.png']
      : ['crash.png', 'debt.png', 'debt2.png'];
    const msgs = isCorrect
      ? ["Finny's rich now!", "You're saving Finny's wallet!", "He’s finally got a budget!"]
      : ["Finny's leased car just exploded 💥", "He's knee-deep in leasing debt 😭", "He maxed his credit card 😵"];

    const idx = Math.floor(Math.random() * imgs.length);
    const imgUrl = `/assets/${folder}/${imgs[idx]}`;

    MySwal.fire({
      title: isCorrect ? 'Correct!' : 'Oops!',
      text: msgs[idx],
      imageUrl: imgUrl,
      imageHeight: 220,
      confirmButtonText: 'Continue',
      customClass: {
        popup: 'rounded-lg shadow-lg',
        title: 'font-luckiest text-3xl',
        content: 'font-comic text-lg',
        confirmButton: 'bg-lime-400 hover:bg-lime-500 rounded px-6 py-2 text-white font-bold shadow-sm',
      }
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

  // This just resets to intro, NOT start the quiz immediately
  const resetToIntro = () => {
    setShowStart(true);
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setTimeUpHandled(false);
    setQuizEnded(false);
    setQuizStartTimestamp(null);
    setTimeLeft(QUIZ_DURATION_SECONDS);
    setSelectedOption(null);
    setAnswersGiven([]);
    localStorage.removeItem(STORAGE_KEY);
    restoredFromStorage.current = false;
  };

  // This starts the quiz from the intro
  const startQuiz = () => {
    if (!allQuestions.length) return;

    const now = Date.now();
    const selected = shuffleArray(allQuestions).slice(0, 10);
    const shuffledQuestions = selected.map(q => ({
      question: q.question,
      options: shuffleArray(q.options),
      answer: q.answer,
    }));

    setQuestions(shuffledQuestions);
    setCurrentIndex(0);
    setScore(0);
    setTimeUpHandled(false);
    setQuizEnded(false);
    setQuizStartTimestamp(now);
    setTimeLeft(QUIZ_DURATION_SECONDS);
    setSelectedOption(null);
    setAnswersGiven([]);
    setShowStart(false);

    localStorage.removeItem(STORAGE_KEY);
    restoredFromStorage.current = false;
  };

  const formatTime = s => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-purple-800 text-white">
        <p className="text-xl">Loading quiz...</p>
      </div>
    );
  }

  if (quizEnded) {
    const passed = score >= 6;
    const finalImg = passed ? '/assets/successImgs/bank.png' : '/assets/failImgs/debt.png';
    const finalTitle = passed ? 'Congratulations! Finny is a Finance Expert!' : 'Nice Try! Finny needs to learn more...';
    const finalMsg = passed
      ? `You scored ${score} / ${questions.length}. Finny’s wallet is happy! 🤑`
      : `You scored ${score} / ${questions.length}. Keep guiding Finny to financial wisdom!`;

    return (
      <div className="min-h-screen bg-purple-800 text-white p-6 px-4">
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src={finalImg}
            alt={passed ? 'Finny Rich' : 'Finny Learning'}
            className="w-72 max-w-full mb-4 rounded-lg shadow-xl"
            style={{ filter: passed ? 'drop-shadow(0 0 15px gold)' : 'drop-shadow(0 0 15px red)' }}
          />
          <h2 className="text-3xl font-luckiest mb-2">{finalTitle}</h2>
          <p className="text-2xl font-comic mb-10">{finalMsg}</p>
        </div>

        <h2 className="text-3xl font-luckiest mb-4 text-center">Review Your Answers</h2>
        <div className="max-w-3xl mx-auto space-y-6">
          {answersGiven.map(({ question, selected, correct }, i) => {
            const isCorrect = selected === correct;
            return (
              <div key={i} className={`p-4 rounded-lg shadow-md ${isCorrect ? 'bg-green-700' : 'bg-red-700'}`}>
                <h2 className=" text-lg mb-1">{`Q${i + 1}: ${question}`}</h2>
                <p>Your answer: <span className="font-semibold">{selected}</span></p>
                {!isCorrect && (
                  <p>Correct answer: <span className="font-semibold">{correct}</span></p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center mt-10">
          <button
            onClick={resetToIntro} // Now shows intro page instead of starting quiz immediately
            className="bg-lime-400 hover:bg-lime-500 transition px-10 py-4 rounded-lg text-white text-2xl font-bold shadow-md"
          >
            Restart Quiz
          </button>
        </div>
      </div>
    );
  }

  if (showStart) {
    // INTRODUCTION PAGE - you can expand this with more story text if you want
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-purple-800 text-white text-center px-6">
        <img src="/assets/learn.png" alt="Finny Confused" className="w-52 sm:w-60 mb-6" />
        <h1 className="text-2xl sm:text-1xl font-luckiest mb-2">Help Finny Learn about Fintrex Finance!</h1>
        <p className="text-lg sm:text-1xl font-comic mb-6 max-w-md px-2">
          Finny is on a journey to become a finance expert! Sometimes he makes mistakes, but with your help, he'll learn about Fintrex Finance.
        </p>
        <p className="text-base sm:text-lg font-comic mb-8 max-w-md px-2">
          Ready to start? Answer the questions wisely and help Finny grow rich!
        </p>
        <button
          onClick={startQuiz}
          className="bg-lime-400 hover:bg-lime-500 transition px-8 py-3 rounded text-white text-xl font-bold shadow-sm w-full max-w-xs sm:max-w-none sm:w-auto"
        >
          Start Quiz
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-purple-800 text-white flex flex-col items-center justify-center px-4 py-8 relative">
      <button
        onClick={() => {
          MySwal.fire({
            title: 'Start a new game?',
            text: 'Your current progress will be lost. Are you sure?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, start over',
            cancelButtonText: 'Cancel',
          }).then((result) => {
            if (result.isConfirmed) {
              resetToIntro(); // Changed to show intro on New Game too
            }
          });
        }}
        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-white font-semibold shadow-md"
        type="button"
      >
        New Game
      </button>

      <div className="w-full max-w-xl">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-5 text-base sm:text-lg font-semibold font-comic gap-2 sm:gap-0">
          <span>Question {currentIndex + 1} / {questions.length}</span>
          <span>Time Left: {formatTime(timeLeft)}</span>
        </div>

        <div className="bg-purple-700 p-6 sm:p-8 rounded-xl shadow-md">
          <h2 className="text-xl sm:text-2xl font-luckiest mb-6">{currentQ.question}</h2>
          <div className="grid gap-3 sm:gap-4 mb-6">
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedOption === opt;
              return (
                <button
                  key={i}
                  onClick={() => !quizEnded && setSelectedOption(opt)}
                  className={`p-4 rounded-lg text-left text-white text-base sm:text-lg font-comic w-full shadow-sm transition
                    ${isSelected ? 'bg-lime-500 hover:bg-lime-600' : 'bg-lime-700 hover:bg-lime-500'}
                  `}
                  type="button"
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <button
            onClick={submitAnswer}
            disabled={selectedOption === null}
            className={`w-full py-3 rounded-lg font-bold text-white text-xl
              ${selectedOption === null ? 'bg-gray-500 cursor-not-allowed' : 'bg-lime-400 hover:bg-lime-500'}
            `}
            type="button"
          >
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;
