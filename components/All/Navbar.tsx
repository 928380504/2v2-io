"use client";

import { ThemeToggle } from "../ThemeToggle";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from 'next/image';
import { useState, useRef } from 'react';

interface NavLink {
  text: string;
  href: string;
}

export default function Navbar() {
  const router = useRouter();

  const links: NavLink[] = [
    { text: "Guide", href: "/#guide" },
    { text: "Youtube", href: "/#youtube" },
    { text: "Faq", href: "/#faq" },
  ];

  return (
    <nav className="bg-green-700 dark:bg-green-800 z-50">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between h-8 md:h-12">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-white font-bold text-xl md:text-2xl">
              2v2.io
              </span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {links.map((link, index) => (
              <div
                key={index}
                className="relative group"
              >
                <Link
                  href={link.href}
                  className="text-white/90 relative px-2 py-1 group text-sm font-semibold transition-all duration-200
                    hover:text-white focus:outline-none rounded flex items-center"
                >
                  {link.text}
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-white transition-all duration-200 group-hover:w-full"></span>
                </Link>
              </div>
            ))}
          </div>

          {/* Theme Toggle */}
          <div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}
