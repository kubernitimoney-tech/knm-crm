import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FaqItem } from '@/data/faq';
import { cn } from '@/lib/utils';

interface FaqAccordionProps {
  items: FaqItem[];
  defaultOpen?: string;
  showCategory?: boolean;
}

export function FaqAccordion({
  items,
  defaultOpen,
  showCategory = true,
}: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen ?? items[0]?.id ?? null);

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-card-border bg-white px-5 py-8 text-center text-sm text-mid-shade">
        No questions in this category yet.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const isOpen = openId === item.id;
        return (
          <div
            key={item.id}
            className={cn(
              'overflow-hidden rounded-2xl border transition-all duration-300',
              isOpen
                ? 'border-accent-indigo/35 bg-white shadow-md ring-1 ring-accent-indigo/10'
                : 'border-card-border bg-white/80 hover:border-accent-indigo/20 hover:shadow-sm',
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${item.id}`}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors',
                  isOpen
                    ? 'bg-primary-deep text-white'
                    : 'bg-bg-app text-mid-shade ring-1 ring-card-border',
                )}
              >
                {String(index + 1).padStart(2, '0')}
              </span>

              <span className="min-w-0 flex-1 font-semibold text-primary-deep">
                {item.question}
              </span>

              {showCategory ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
                    isOpen
                      ? 'bg-accent-indigo/10 text-accent-indigo'
                      : 'bg-bg-app text-light-gray',
                  )}
                >
                  {item.category}
                </span>
              ) : null}

              <ChevronDown
                className={cn(
                  'h-5 w-5 shrink-0 text-mid-shade transition-transform duration-300',
                  isOpen && 'rotate-180 text-accent-indigo',
                )}
              />
            </button>

            <div
              id={`faq-answer-${item.id}`}
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className="border-t border-card-border/80 px-4 pb-4 pt-3 sm:px-5">
                  <p className="pl-11 text-sm leading-relaxed text-mid-shade">
                    {item.answer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
