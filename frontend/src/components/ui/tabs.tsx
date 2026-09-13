import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-auto w-max max-w-full items-center justify-start gap-0.5 rounded-full p-1",
      "border border-primary-deep/15 bg-primary-deep/10",
      "dark:border-secondary-dark/60 dark:bg-primary-deep/50",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2",
      "text-xs font-semibold transition-all duration-200",
      "text-mid-shade hover:text-primary-deep",
      "dark:text-lighter-gray dark:hover:text-white",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-deep/30 focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=active]:border data-[state=active]:border-secondary-dark/50",
      "data-[state=active]:bg-primary-deep data-[state=active]:text-white data-[state=active]:shadow-sm",
      "dark:data-[state=active]:border-mid-shade/40 dark:data-[state=active]:bg-secondary-dark dark:data-[state=active]:text-white",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-6 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-deep/30 focus-visible:ring-offset-2",
      "dark:ring-offset-slate-950",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
