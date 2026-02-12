import { compileMDX } from 'next-mdx-remote/rsc';
import fs from 'fs';
import path from 'path';

export async function getBlogPost(slug: string) {
  const filePath = path.join(process.cwd(), 'app/blog', `${slug}.mdx`);
  const source = fs.readFileSync(filePath, 'utf-8');

  const { content, frontmatter } = await compileMDX({
    source,
    options: { parseFrontmatter: true }
  });

  return { content, frontmatter };
}