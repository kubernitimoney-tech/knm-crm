import { Link, Navigate, useParams } from 'react-router-dom';
import { CtaBanner } from '@/components/CtaBanner';
import { JsonLd } from '@/components/JsonLd';
import { getBlogPost } from '@/data/blog-posts';
import { articleSchema } from '@/lib/seo-schemas';

export function BlogPostPage() {
  const { slug = '' } = useParams();
  const post = getBlogPost(slug);
  if (!post) return <Navigate to="/blog" replace />;

  return (
    <>
      <JsonLd
        data={articleSchema({
          title: post.title,
          description: post.excerpt,
          slug: post.slug,
          publishedAt: post.publishedAt,
        })}
      />
      <div className="py-12 md:py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <p className="text-sm text-light-gray">{post.publishedAt}</p>
          <h1 className="section-heading mt-2">{post.title}</h1>
          <p className="mt-4 text-lg text-mid-shade">{post.excerpt}</p>

          <div className="mt-10 space-y-8">
            {post.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-semibold text-primary-deep">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 20)} className="mt-3 leading-relaxed text-mid-shade">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold text-primary-deep">Related articles</h2>
            <ul className="mt-3 space-y-2">
              {post.relatedSlugs.map((related) => (
                <li key={related}>
                  <Link to={`/blog/${related}`} className="text-accent-indigo hover:underline">
                    {related.replace(/-/g, ' ')}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <CtaBanner />
    </>
  );
}
