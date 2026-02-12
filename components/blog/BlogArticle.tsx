import { CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'

interface BlogArticleProps {
  children: React.ReactNode
  intro: {
    category: string
    title: string
    description: string
  }
  meta: {
    author: string
    avatar?: string
    date: string
    category: string
    readingTime?: string
  }
  relatedPosts?: {
    title: string
    excerpt: string
    slug: string
  }[]
}

export default function BlogArticle({ 
  children, 
  intro, 
  meta, 
  relatedPosts = [] 
}: BlogArticleProps) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="px-6 lg:px-8">
        <BlogIntro {...intro} />
        <BlogMeta {...meta} />
        <div className="mt-8 bg-white dark:bg-gray-800/50 rounded-xl p-8 border border-gray-400 dark:border-white-400">
          <div className="mx-auto text-base/7 text-gray-700 dark:text-gray-300">
            {children}
          </div>
        </div>

        {/* 相关文章 */}
        {relatedPosts.length > 0 && (
          <div className="mt-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {relatedPosts.map((post) => (
                <Link
                  key={post.title}
                  href={`/blog/${post.slug}`}
                  className="block group bg-white dark:bg-gray-800/50 rounded-xl p-6 hover:shadow-lg transition-shadow border border-gray-400 dark:border-white-400"
                >
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 group-hover:text-emerald-600">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">{post.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 导出可在 MDX 中使用的子组件
export function BlogIntro({ category, title, description }: { category: string; title: string; description: string }) {
  return (
    <>
      <p className="mt-8 text-base/7 font-semibold text-emerald-600 dark:text-emerald-400">{category}</p>
      <h1 className="mt-2 text-pretty text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
        {title}
      </h1>
      <blockquote className="mt-6 border-l-4 border-emerald-600 pl-4 italic text-xl/8 text-gray-600 dark:text-gray-400">
        {description}
      </blockquote>
    </>
  )
}

export function CheckList({ items }: { items: Array<{ title: string; description: string }> }) {
  return (
    <ul role="list" className="mt-8 max-w-xl space-y-4 text-gray-600 dark:text-gray-400">
      {items.map((item, index) => (
        <li key={index} className="flex gap-x-2">
          <CheckCircleIcon aria-hidden="true" className="mt-1 h-4 w-4 flex-none text-emerald-600" />
          <span>
            <strong className="font-semibold text-gray-900 dark:text-gray-100">{item.title}</strong> {item.description}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Quote({ text, author, role, image }: { text: string; author: string; role: string; image?: string }) {
  return (
    <figure className="mt-10 border-l border-emerald-600 pl-9">
      <blockquote className="font-semibold text-gray-900 dark:text-gray-100">
        <p>{text}</p>
      </blockquote>
      <figcaption className="mt-6 flex gap-x-4">
        {image && (
          <img
            alt={author}
            src={image}
            className="h-4 w-4 flex-none rounded-full bg-gray-50"
          />
        )}
        <div className="text-sm/6">
          <strong className="font-semibold text-gray-900 dark:text-gray-100">{author}</strong> – {role}
        </div>
      </figcaption>
    </figure>
  )
}

export function ImageWithCaption({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="mt-16">
      <img
        alt={alt}
        src={src}
        className="aspect-video rounded-xl bg-gray-50 object-cover"
      />
      <figcaption className="mt-4 flex gap-x-2 text-sm/6 text-gray-500">
        <InformationCircleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-emerald-300" />  {/* 修改尺寸 */}
        {caption}
      </figcaption>
    </figure>
  )
}

export function BlogMeta({ 
  author, 
  avatar, 
  date,
  readingTime,
  category 
}: { 
  author: string
  avatar?: string
  date: string
  readingTime?: string
  category: string 
}) {
  return (
    <div className="mt-8 flex items-center gap-x-2 text-sm">
      {avatar && (
        <img
          src={avatar}
          alt={author}
          className="h-8 w-8 rounded-full"
        />
      )}
      <span className="font-medium">{author}</span>
      <span className="text-gray-500">|</span>
      <time className="text-gray-500" dateTime={date}>
        Published: {new Date(date).toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        })} GMT+8
      </time>
    </div>
  )
}