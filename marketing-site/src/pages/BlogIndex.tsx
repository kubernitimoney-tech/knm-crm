import { Link } from 'react-router-dom';
import { CtaBanner } from '@/components/CtaBanner';
import { PageHero } from '@/components/PageHero';
import { blogPosts } from '@/data/blog-posts';

export function BlogIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="Resources"
        title="Loan guides and financial tips"
        description="Expert articles on personal loans, CIBIL scores, EMI planning, and responsible borrowing — written for salaried professionals."
        image="/shopping-loan/shopping-1.svg"
        imageAlt="Loan guides and financial tips"
        chips={[`${blogPosts.length} articles`, 'Practical advice', 'Updated regularly']}
        actions={
          <>
            <Link to="/apply" className="btn-primary">
              Apply Now
            </Link>
            <Link to="/faq" className="btn-secondary">
              View FAQ
            </Link>
          </>
        }
      />

      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            {blogPosts.map((post) => (
              <article key={post.slug} className="card">
                <p className="text-xs text-light-gray">{post.publishedAt}</p>
                <h2 className="mt-2 text-xl font-semibold text-primary-deep">
                  <Link to={`/blog/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-mid-shade">{post.excerpt}</p>
                <Link
                  to={`/blog/${post.slug}`}
                  className="mt-4 inline-block text-sm font-semibold text-accent-indigo hover:underline"
                >
                  Read article →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </>
  );
}
