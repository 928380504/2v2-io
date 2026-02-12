import { useState, useEffect, useRef, useCallback, memo } from 'react';

interface GameIframeFacadeProps {
  gameUrl: string;
  height?: string;
  className?: string;
}

const GameIframeFacade = memo(({ gameUrl, height = '600px', className = '' }: GameIframeFacadeProps) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) {
      setShouldLoad(true);
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      handleIntersection,
      {
        rootMargin: '100px',
        threshold: 0.1 // 降低阈值以提高性能
      }
    );

    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [handleIntersection]);

  return (
    <div 
      ref={containerRef}
      className={`relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      {shouldLoad ? (
        <iframe
          src={gameUrl}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          loading="lazy"
          title="Game iframe"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading game...</p>
          </div>
        </div>
      )}
    </div>
  );
});

GameIframeFacade.displayName = 'GameIframeFacade';

export { GameIframeFacade }; 