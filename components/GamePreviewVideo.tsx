"use client"; // 明确标记为客户端组件

import { useEffect, useRef, useState } from 'react';

interface GamePreviewVideoProps {
  videoUrl: string;
  className?: string;
}

export function GamePreviewVideo({ videoUrl, className = "" }: GamePreviewVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isBrowser, setIsBrowser] = useState(false);

  // 确保只在客户端执行
  useEffect(() => {
    setIsBrowser(true);
  }, []);

  useEffect(() => {
    // 确保在浏览器环境且视频元素存在
    if (isBrowser && videoRef.current) {
      // 重置视频时间到开始
      videoRef.current.currentTime = 0;
      // 设置播放速度为2倍
      videoRef.current.playbackRate = 2.0;
      // 播放视频
      videoRef.current.play().catch(error => {
        console.log('Video autoplay failed:', error);
      });
    }
  }, [videoUrl, isBrowser]); // 当 videoUrl 改变或确认在浏览器环境时重新触发

  // 如果不在浏览器环境，返回一个占位符
  if (!isBrowser) {
    return <div className={className}></div>;
  }

  return (
    <video 
      ref={videoRef}
      className={className}
      loop 
      muted 
      playsInline
      preload="auto"
    >
      <source src={videoUrl} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
}