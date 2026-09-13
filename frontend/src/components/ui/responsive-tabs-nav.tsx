import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppSelect } from '@/components/ui/app-select';
import { cn } from '@/lib/utils';

export interface ResponsiveTabItem {
  value: string;
  label: string;
}

interface ResponsiveTabsNavProps {
  items: readonly ResponsiveTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  selectClassName?: string;
}

const minimalTabsListClassName = cn(
  'mb-6 h-auto w-full max-w-full justify-start gap-1 overflow-x-auto scrollbar-hide rounded-none border-0 border-b border-slate-200/80 bg-transparent p-0',
  'dark:border-slate-800',
);

const minimalTabsTriggerClassName = cn(
  'rounded-none border-0 bg-transparent px-3 py-2.5 shadow-none',
  'text-xs font-semibold text-slate-500 hover:text-primary-deep',
  'dark:text-slate-400 dark:hover:text-white',
  'data-[state=active]:border-0 data-[state=active]:bg-transparent data-[state=active]:text-primary-deep',
  'data-[state=active]:shadow-none dark:data-[state=active]:text-white',
  'relative data-[state=active]:after:absolute data-[state=active]:after:bottom-0',
  'data-[state=active]:after:left-0 data-[state=active]:after:h-0.5 data-[state=active]:after:w-full',
  'data-[state=active]:after:bg-primary-deep dark:data-[state=active]:after:bg-secondary-dark',
);

export function ResponsiveTabsNav({
  items,
  value,
  onValueChange,
  className,
  selectClassName,
}: ResponsiveTabsNavProps) {
  return (
    <>
      <div className={cn('mb-6 md:hidden', selectClassName)}>
        <AppSelect
          value={value}
          onValueChange={onValueChange}
          options={items.map((tab) => ({ value: tab.value, label: tab.label }))}
          triggerClassName="w-full"
        />
      </div>

      <TabsList className={cn(minimalTabsListClassName, 'max-md:hidden', className)}>
        {items.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className={cn(minimalTabsTriggerClassName, 'shrink-0')}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </>
  );
}
