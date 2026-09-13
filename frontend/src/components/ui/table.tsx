import * as React from "react"

import { LoadingState } from "@/components/ui/loading-state"
import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/10"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs bg-white dark:bg-transparent transition-colors border-collapse", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 sticky top-0 z-10", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 divide-y divide-slate-100 dark:divide-slate-800/60", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 dark:bg-slate-900/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-light-gray/10 dark:border-slate-800 transition-colors hover:bg-slate-50/40 dark:hover:bg-white/10 bg-white dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-4 text-left align-middle font-black whitespace-nowrap text-[10px] uppercase tracking-widest text-slate-400 dark:text-[#B0B0C1] [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-1.5 align-middle whitespace-nowrap text-xs font-normal text-slate-500 dark:text-slate-300 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function TableLoadingRow({
  colSpan,
  message = "Loading…",
  compact = false,
}: {
  colSpan: number
  message?: string
  compact?: boolean
}) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        className={cn(compact ? "h-24" : "h-64", "text-center")}
      >
        <LoadingState
          message={message}
          size={compact ? 'compact' : 'default'}
          className={compact ? 'py-6' : 'py-12'}
        />
      </TableCell>
    </TableRow>
  )
}

function TableAreaLoader({
  message = "Loading…",
  className,
}: {
  message?: string
  className?: string
}) {
  return (
    <LoadingState layout="section" message={message} className={cn('min-h-64 py-12', className)} />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableLoadingRow,
  TableAreaLoader,
}
