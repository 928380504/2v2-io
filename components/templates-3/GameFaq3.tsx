"use client";

import { ChevronDown } from 'lucide-react';

export interface GameFaqItem {
  question: string;
  answer: string;
}

interface GameFaqProps {
  gameTitle: string;
  items?: GameFaqItem[];
}

export function GameFaq({ gameTitle, items }: GameFaqProps) {
  const faqItems = items ?? [
    {
      question: `What is ${gameTitle}?`,
      answer: `${gameTitle} is a browser game that you can launch directly from this page without installing a separate app.`,
    },
    {
      question: `How do I start playing ${gameTitle}?`,
      answer: `Select Play now in the game area above. The game will load in the same page, and its controls will appear when it is ready.`,
    },
    {
      question: `What controls does ${gameTitle} use?`,
      answer: `Controls vary by game and device. Desktop games commonly use the keyboard and mouse, while supported mobile games provide on-screen controls.`,
    },
    {
      question: `Do I need to download ${gameTitle}?`,
      answer: `No separate download is required. A modern browser with JavaScript and WebGL enabled is recommended.`,
    },
  ];

  return (
    <div className="space-y-3">
      {faqItems.map((item) => (
        <details
          key={item.question}
          className="group overflow-hidden rounded-xl border border-green-100 bg-green-50/60 open:bg-green-50 dark:border-green-700/35 dark:bg-green-950/25 dark:open:bg-green-950/40"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-bold text-gray-900 marker:content-none dark:text-white sm:text-base">
            {item.question}
            <ChevronDown className="h-4 w-4 shrink-0 text-green-700 transition-transform duration-200 group-open:rotate-180 dark:text-green-300" />
          </summary>
          <p className="border-t border-green-100 px-4 py-3 text-sm leading-6 text-gray-600 dark:border-green-700/35 dark:text-gray-200">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
