import { Leaf } from "lucide-react";
// 删除未使用的导入
import Image from 'next/image';
import Link from 'next/link';

// Define social media links
const socialLinks = [
  {
    name: 'Facebook',
    icon: '/facebook.svg',
    url: 'https://facebook.com/share/planet-clicker'
  },
  {
    name: 'Twitter',
    icon: '/twitter.svg',
    url: 'https://twitter.com/intent/tweet?text=Play%20Planet%20Clicker%20now!'
  },
  {
    name: 'Reddit',
    icon: '/reddit.svg',
    url: 'https://reddit.com/r/planetclicker'
  },
  {
    name: 'Discord',
    icon: '/discord.svg',
    url: 'https://discord.gg/planetclicker'
  }
]

export function Footer() {
  return (
    <footer className="bg-green-700 dark:bg-green-800">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8">
        </div>

        {/* Social Icons & Copyright */}
        <div className="flex flex-col md:flex-row justify-between items-center mt-4 pt-4 border-t border-white/20 space-y-2 md:space-y-0">
          <p className="text-white/90 text-xs">
            © {new Date().getFullYear()} 2v2-io.com All rights reserved.
          </p>
          
          <div className="flex space-x-4">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full p-1"
                aria-label={`Follow us on ${social.name}`}
              >
                <Image
                  src={social.icon}
                  alt={social.name}
                  width={20}
                  height={20}
                  className="w-5 h-5 brightness-0 invert"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
