import { useState, useEffect } from 'react';

interface ScreenResolution {
  width: number;
  height: number;
}

interface UseScreenResolutionReturn {
  resolution: ScreenResolution;
  isLargeScreen: boolean; // 1920x1080及以上
  isMediumScreen: boolean; // 1366x768
  isLoading: boolean;
}

export const useScreenResolution = (): UseScreenResolutionReturn => {
  const [resolution, setResolution] = useState<ScreenResolution>({
    width: 0,
    height: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const updateResolution = () => {
      setResolution({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setIsLoading(false);
    };

    // 初始化
    updateResolution();

    // 监听窗口大小变化
    window.addEventListener('resize', updateResolution);

    return () => {
      window.removeEventListener('resize', updateResolution);
    };
  }, []);

  // 判断是否为大屏幕 (1920宽度及以上，考虑浏览器窗口可能不是全屏)
  const isLargeScreen = resolution.width >= 1800; // 降低阈值以适应浏览器窗口
  
  // 判断是否为中等屏幕 (1366x768)
  const isMediumScreen = resolution.width >= 1366 && resolution.width < 1800;

  return {
    resolution,
    isLargeScreen,
    isMediumScreen,
    isLoading,
  };
};