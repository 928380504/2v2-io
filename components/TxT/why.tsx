import { MousePointer, TrendingUp, Sparkles, Trophy, Brain, Clock, Star, Rocket } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard = ({ icon, title, description }: FeatureCardProps) => (
  <div className="relative bg-white/80 dark:bg-green-800/30 rounded-2xl p-6 hover:translate-y-[-4px] transition-all duration-300 shadow-sm hover:shadow-md">
    <div className="flex flex-col items-center">
      <div className="mb-5 relative">
        <div className="absolute inset-0 bg-green-500/10 dark:bg-green-400/10 blur-xl rounded-full"></div>
        <div className="relative w-16 h-16 bg-green-600 dark:bg-green-700 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      </div>
      <h3 className="text-green-800 dark:text-green-100 font-semibold text-lg mb-2 text-center">
        {title}
      </h3>
      <p className="text-gray-700 dark:text-gray-200 text-center text-base">
        {description}
      </p>
    </div>
  </div>
);

export function Features() {
  const features = [
    {
      icon: <Brain className="w-8 h-8 text-white/90" />,
      title: "Tactical Thinking",
      description: "Improve decision-making with rotations, positioning, and smart engagement timing."
    },
    {
      icon: <Clock className="w-8 h-8 text-white/90" />,
      title: "Quick Matches",
      description: "Fast-paced rounds make it easy to play a few games anytime."
    },
    {
      icon: <Star className="w-8 h-8 text-white/90" />,
      title: "Team Wins",
      description: "Nothing beats a clean duo fight and a clutch finish with your teammate."
    },
    {
      icon: <Rocket className="w-8 h-8 text-white/90" />,
      title: "Instant Building",
      description: "Build walls, ramps, and roofs on the fly to create cover and take high ground."
    }
  ];

  return (
    <section id="features" className="bg-green-50 dark:bg-green-900/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 text-sm font-medium mb-4">
            Benefits
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-green-800 dark:text-green-100 mb-4">
            Why Play 2v2.io?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            A duo battle royale with instant building and nonstop action
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
