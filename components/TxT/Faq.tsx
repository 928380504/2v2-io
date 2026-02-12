import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface FaqItemProps {
  question: string;
  answer: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}

const FaqItem = ({ question, answer, isOpen, onClick }: FaqItemProps) => (
  <div className="border-b border-gray-200 dark:border-green-800/30 bg-white dark:bg-green-800/30 shadow-sm hover:shadow-md hover:translate-y-[-4px] transition-all duration-300 rounded-lg mb-4 p-4">
    <button
      className="flex w-full items-center justify-between py-4 text-left"
      onClick={onClick}
    >
      <h3 className="text-lg font-medium text-green-800 dark:text-green-100">
        {question}
      </h3>
      <ChevronDown 
        className={`w-5 h-5 text-green-600 dark:text-green-400 transition-transform duration-200 ${
          isOpen ? 'transform rotate-180' : ''
        }`}
      />
    </button>
    <div
      className={`overflow-hidden transition-all duration-200 ${
        isOpen ? 'max-h-96 pb-4' : 'max-h-0'
      }`}
    >
      <div className="text-gray-600 dark:text-gray-300">
        {answer}
      </div>
    </div>
  </div>
);

export function Faq() {
  const [openStates, setOpenStates] = useState<boolean[]>([true, true, true, true, true]);

  const faqs = [
    {
      question: "Do I need to download anything to play?",
      answer: "No download needed. 2v2.io runs directly in your web browser, so you can jump into a match quickly."
    },
    {
      question: "Can I play with a friend?",
      answer: "Yes. 2v2.io is designed around two-player squads, so playing with a friend is the best way to coordinate and win."
    },
    {
      question: "What kind of game is 2v2.io?",
      answer: "It is a duo-focused battle royale shooter with simplified instant building. You fight other squads while the safe zone shrinks, so every match pushes you into action."
    },
    {
      question: "Does 2v2.io have cosmetics or progression?",
      answer: "Yes. Many versions include unlockable cosmetics such as skins and hats, typically earned through playing and winning."
    },
    {
      question: "Is 2v2.io mobile-friendly?",
      answer: "2v2.io is best on desktop browsers for precise aim and building. Some devices may work, but keyboard-and-mouse is the intended experience."
    }
  ];

  const toggleQuestion = (index: number) => {
    const newOpenStates = [...openStates];
    newOpenStates[index] = !newOpenStates[index];
    setOpenStates(newOpenStates);
  };

  return (
    <section id="faq">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
            Frequently Asked Questions
          </h2>
          <div className="w-24 h-1 bg-green-500 mx-auto mb-8"></div>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Quick answers about playing 2v2.io and what to expect.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <FaqItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openStates[index]}
              onClick={() => toggleQuestion(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
