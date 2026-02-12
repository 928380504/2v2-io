"use client";

import Link from 'next/link';
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Eye, Calendar } from 'lucide-react';
import { useState, FormEvent, ReactNode } from 'react';
import Image from 'next/image';

interface Comment {
  id: number;
  author: string;
  content: string;
  date: string;
  likes: number;
  dislikes: number;
}

interface Category {
  name: string;
  href: string;
}

interface Rating {
  score: number;
  votes: number;
}

interface GameIntro2Props {
  title: string;
  description: string;
  categories: Category[];
  tags?: Category[];
  rating?: Rating;
  backgroundImage?: string;
  views?: number;
  createdAt?: string;
  onRate?: (score: number) => void;
  videoComponent?: ReactNode;
}

export function GameIntro2({ 
  title,
  description,
  categories,
  tags = [
    { name: "Incremental Clicker Games", href: "/clicker-games/incremental-clicker-games" }
  ],
  rating,
  backgroundImage,
  views,
  createdAt,
  onRate,
  videoComponent
}: GameIntro2Props) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const handleRating = (score: number) => {
    if (!hasVoted) {
      setUserRating(score);
      setHasVoted(true);
      onRate?.(score);
    }
  };

  const getStarColor = (index: number) => {
    const score = hoverRating ?? userRating ?? rating?.score ?? 0;
    if (index < Math.floor(score)) {
      return 'text-yellow-400 fill-current cursor-pointer';
    } else if (index < score) {
      return 'text-yellow-400 fill-current opacity-50 cursor-pointer';
    } else {
      return 'text-gray-300 dark:text-gray-600 cursor-pointer';
    }
  };

  // 评论状态
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 1,
      author: "John",
      content: "Great game! I really enjoyed playing it.",
      date: "2024-01-20",
      likes: 5,
      dislikes: 1
    },
    {
      id: 2,
      author: "Alice",
      content: "The graphics are amazing and the gameplay is smooth.",
      date: "2024-01-19",
      likes: 3,
      dislikes: 0
    }
  ]);

  const handleSubmitComment = (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const author = (form.comment_author as HTMLInputElement).value;
    const content = (form.comment_content as HTMLTextAreaElement).value;
    const checked = (form.commentChecked as HTMLInputElement).checked;

    if (!author || !content || !checked) {
      alert('Please fill in all required fields and agree to the terms.');
      return;
    }

    const newComment: Comment = {
      id: comments.length + 1,
      author,
      content,
      date: new Date().toLocaleDateString(),
      likes: 0,
      dislikes: 0
    };

    setComments([newComment, ...comments]);
    form.reset();
  };

  return (
    <div className="bg-white/80 dark:bg-[#0d4021] backdrop-blur-sm rounded-xl p-6 shadow-lg">
      {/* 广告区域 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Link 
              href="/"
              className="text-green-600 dark:text-green-400 hover:underline"
            >
              Home
            </Link>
            <span className="text-gray-400">/</span>
            {categories.map((category, index) => (
              <div key={category.href} className="flex items-center gap-2">
                <Link
                  href={category.href}
                  className="text-green-600 dark:text-green-400 hover:underline"
                >
                  {category.name}
                </Link>
                {index < categories.length - 1 && (
                  <span className="text-gray-400">/</span>
                )}
              </div>
            ))}
            <span className="text-gray-400">/</span>
            <span className="text-gray-600 dark:text-gray-300">{title}</span>
          </div>
        </div>
      </div>

      {/* 游戏信息 */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {title}
        </h2>

        {/* 数据统计 */}
        <div className="flex items-center gap-3 mb-4 text-sm">
          {/* Rating */}
          <div className="flex items-center gap-1">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => {
                const difference = (rating?.score || 0) - star;
                return (
                  <svg 
                    key={star} 
                    className="w-3.5 h-3.5" 
                    fill={difference >= -0.2 ? "#FBBF24" : "#E5E7EB"} 
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                );
              })}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {rating?.score.toFixed(1)} ({rating?.votes} votes)
            </span>
          </div>

          {/* Views */}
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {views} views
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {createdAt}
            </span>
          </div>
        </div>

        {/* 视频预览 */}
        {videoComponent}

        {/* 游戏描述 */}
        <div className="prose dark:prose-invert max-w-none space-y-8 mt-8"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      </div>

      {/* 评论区域 */}
      <div id="comments_area">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Comments
        </h2>

        {/* 评论表单 */}
        <form onSubmit={handleSubmitComment} className="mb-8">
          <div className="row">
            <div className="col-md-6">
              <input 
                type="text" 
                name="comment_author" 
                className="form-control" 
                placeholder="Your Name" 
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <textarea 
                name="comment_content" 
                className="form-control" 
                placeholder="Your Comment"
                rows={4}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <div className="flex items-center gap-2 mt-4">
                <input 
                  type="checkbox" 
                  name="commentChecked" 
                  id="commentChecked" 
                />
                <label htmlFor="commentChecked" className="text-sm text-gray-600 dark:text-gray-300">
                  I agree to the terms and conditions
                </label>
              </div>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <button 
                type="submit" 
                className="btn1 btn-primary mt-4"
              >
                Submit Comment
              </button>
            </div>
          </div>
        </form>

        {/* 评论列表 */}
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="replyWrap clearAfter bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="listProfile">
                <div className="img-thumbnail">{comment.author[0]}</div>
                <span className="user">{comment.author}</span>
                <span className="user">{comment.date}</span>
              </div>
              <div className="listContent">
                <div className="comment--content text-gray-700 dark:text-gray-300">
                  {comment.content}
                </div>
                <div className="control-action">
                  <button className="group flex items-center gap-1 mr-4 text-gray-500 hover:text-green-600">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">Reply</span>
                  </button>
                  <button className="group flex items-center gap-1 mr-4 text-gray-500 hover:text-blue-500">
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm">{comment.likes}</span>
                  </button>
                  <button className="group flex items-center gap-1 text-gray-500 hover:text-red-500">
                    <ThumbsDown className="w-4 h-4" />
                    <span className="text-sm">{comment.dislikes}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 