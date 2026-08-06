import { useState } from "react";

export default function Flashcard({ question, answer }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="w-full h-40 cursor-pointer perspective"
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className={`relative w-full h-full transition-transform duration-700 preserve-3d ${
          flipped ? "rotate-y-180" : ""
        }`}
      >
        <div className="absolute w-full h-full flex items-center justify-center p-4 rounded-xl shadow bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-medium backface-hidden">
          {question}
        </div>
        <div className="absolute w-full h-full flex items-center justify-center p-4 rounded-xl shadow bg-blue-600 text-white font-medium backface-hidden rotate-y-180">
          {answer}
        </div>
      </div>
    </div>
  );
}
