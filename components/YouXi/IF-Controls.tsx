// 这是if游戏框的区域中的：控制栏区域
import { ThumbsUp, ThumbsDown, Maximize2, PictureInPicture2, Share2, Link } from "lucide-react";
import { useState, useCallback } from "react";

interface GameControlsProps {
  title: string;
  likes?: number;
  dislikes?: number;
  iframeId?: string;
}

interface ShareButtonProps {
  platform: string;
  bgColor: string;
  icon: string;
  onClick: () => void;
}

const ShareButton = ({ platform, bgColor, icon, onClick }: ShareButtonProps) => (
  <button 
    className={`${bgColor} text-white p-1.5 rounded-full hover:opacity-90 transition-all hover:scale-105 hover:shadow-md group relative`}
    aria-label={`Share on ${platform}`}
    onClick={onClick}
  >
    <img src={`/${icon}.svg`} alt={platform} className="w-3.5 h-3.5" />
    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
      Share on {platform}
    </span>
  </button>
);

export const GameControls = ({ 
  title, 
  likes: initialLikes = 0, 
  dislikes: initialDislikes = 0,
  iframeId = 'gameFrame'
}: GameControlsProps) => {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [copied, setCopied] = useState(false);

  // 分享功能
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  
  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(currentUrl)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}`,
    reddit: `https://reddit.com/submit?url=${encodeURIComponent(currentUrl)}`
  };

  const handleShare = (platform: keyof typeof shareUrls) => {
    window.open(shareUrls[platform], '_blank', 'width=600,height=400');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // 3. 移除 handleFavorite 函数
  const handleLike = () => {
    if (isLiked) {
      setLikes(prev => prev - 1);
      setIsLiked(false);
    } else {
      if (isDisliked) {
        setDislikes(prev => prev - 1);
        setIsDisliked(false);
      }
      setLikes(prev => prev + 1);
      setIsLiked(true);
    }
  };

  // 踩处理
  const handleDislike = () => {
    if (isDisliked) {
      setDislikes(prev => prev - 1);
      setIsDisliked(false);
    } else {
      if (isLiked) {
        setLikes(prev => prev - 1);
        setIsLiked(false);
      }
      setDislikes(prev => prev + 1);
      setIsDisliked(true);
    }
  };

  // 全屏处理
  const toggleFullscreen = useCallback(() => {
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (!iframe) return;
  
    try {
      if (!document.fullscreenElement) {
        // 检查各种浏览器前缀的全屏 API
        if (iframe.requestFullscreen) {
          iframe.requestFullscreen();
        } else if ((iframe as any).webkitRequestFullscreen) {
          (iframe as any).webkitRequestFullscreen();
        } else if ((iframe as any).mozRequestFullScreen) {
          (iframe as any).mozRequestFullScreen();
        } else if ((iframe as any).msRequestFullscreen) {
          (iframe as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('全屏模式不可用:', err);
    }
  }, [iframeId]);

  // 悬浮窗处理
  const toggleFloating = useCallback(() => {
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (!iframe) return;

    if (!isFloating) {
      // 创建悬浮窗
      const floatingWindow = window.open('', '_blank', 'width=800,height=600');
      if (floatingWindow) {
        floatingWindow.document.body.style.margin = '0';
        const newIframe = floatingWindow.document.createElement('iframe');
        newIframe.src = iframe.src;
        newIframe.style.width = '100%';
        newIframe.style.height = '100vh';
        newIframe.style.border = 'none';
        floatingWindow.document.body.appendChild(newIframe);
        setIsFloating(true);
      }
    }
  }, [iframeId, isFloating]);

  return (
    <div className="bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm rounded-bl-3xl py-1 px-2 sm:py-1.5 sm:px-3 shadow-[0_8px_30px_rgb(0,0,0,0.2)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:justify-between">
        {/* 左侧分享按钮 */}
        <div className="order-2 sm:order-1 hidden md:block">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-gray-700 dark:text-gray-200 font-medium">Share:</span>
            </div>
            <div className="flex gap-2">
              <ShareButton 
                platform="Facebook" 
                bgColor="bg-[#1877F2]" 
                icon="facebook" 
                onClick={() => handleShare('facebook')} 
              />
              <ShareButton 
                platform="Twitter" 
                bgColor="bg-[#1DA1F2]" 
                icon="twitter" 
                onClick={() => handleShare('twitter')} 
              />
              <ShareButton 
                platform="WhatsApp" 
                bgColor="bg-[#25D366]" 
                icon="whatsapp" 
                onClick={() => handleShare('whatsapp')} 
              />
              <ShareButton 
                platform="Telegram" 
                bgColor="bg-[#0088cc]" 
                icon="telegram" 
                onClick={() => handleShare('telegram')} 
              />
              <ShareButton 
                platform="Reddit" 
                bgColor="bg-[#FF4500]" 
                icon="reddit" 
                onClick={() => handleShare('reddit')} 
              />
              {/* 修改复制链接按钮 */}
              <button 
                className="bg-gray-500 text-white p-1.5 rounded-full hover:opacity-90 transition-all hover:scale-105 hover:shadow-md group relative"
                onClick={handleCopyLink}
              >
                <Link className="w-3.5 h-3.5" />
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-1.5 py-0.5 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {copied ? 'Copied!' : 'Copy Link'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 右侧控制按钮 */}
        <div className="flex items-center w-full sm:w-auto justify-between sm:justify-end gap-1.5 order-1 sm:order-2 ml-auto">
          {/* 点赞/踩 按钮组 */}
          <div className="flex items-center gap-1.5">
            <button 
              className={`flex items-center gap-1 p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors
                ${isLiked ? 'text-green-500 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={handleLike}
              aria-label="Like"
              aria-pressed={isLiked}
            >
              <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs">{likes}K</span>
            </button>
            
            <button 
              className={`flex items-center gap-1 p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors
                ${isDisliked ? 'text-red-500 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}
              onClick={handleDislike}
              aria-label="Dislike"
              aria-pressed={isDisliked}
            >
              <ThumbsDown className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-xs">{dislikes}K</span>
            </button>
          </div>
          
         
          {/* 分隔线 */}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

          {/* 悬浮窗按钮 */}
          <button 
            className={`hidden md:flex items-center gap-1 p-1 sm:p-1.5 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white rounded-lg transition-colors w-[48px] h-[32px] justify-center text-gray-600 dark:text-gray-300`}
            onClick={toggleFloating}
            aria-label="Float Window"
            aria-pressed={isFloating}
          >
            <PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* 全屏按钮 */}
          <button 
            className="group p-1.5 sm:p-2 bg-gray-200 hover:bg-green-600 dark:bg-gray-700 dark:hover:bg-green-600 rounded-lg transition-all duration-200 w-[48px] h-[32px] flex items-center justify-center hover:scale-105 active:scale-95"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            aria-pressed={isFullscreen}
          >
            <Maximize2 className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700 dark:text-gray-100 group-hover:text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};