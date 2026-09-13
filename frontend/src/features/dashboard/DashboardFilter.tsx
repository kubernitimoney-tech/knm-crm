import React from 'react';
import { Filter, X, Calendar, BarChart3, LayoutDashboard, Clock, History, CalendarDays, Orbit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { selectPlaceholder } from '@/lib/placeholders';

interface FilterState {
  reportType: string;
  sortBy: string;
}

interface DashboardFilterProps {
  onApply: (filters: FilterState) => void;
  currentFilters: FilterState;
}

export const DashboardFilter = ({ onApply, currentFilters }: DashboardFilterProps) => {
  const [filters, setFilters] = React.useState<FilterState>(currentFilters);
  const [open, setOpen] = React.useState(false);

  const handleApply = () => {
    onApply(filters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetState = { reportType: 'Business Overview', sortBy: 'This Month' };
    setFilters(resetState);
    onApply(resetState);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-primary-deep rounded-xl text-[12px] font-black shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-left group"
          >
            <Filter size={14} className="text-slate-400 group-hover:text-primary-deep transition-colors" />
            Advanced Filters
          </button>
        }
      />
      <DialogContent className="sm:max-w-[480px] bg-white border-0 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] rounded-[32px] overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary-deep to-secondary-dark p-8 text-white relative overflow-hidden">
           {/* Decorative elements */}
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
           <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-xl" />

           <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <LayoutDashboard size={18} className="text-white" />
                 </div>
                 <h2 className="text-lg font-black tracking-tight uppercase">Dashboard Configuration</h2>
              </div>
              <p className="text-sm text-white/60 font-medium italic">Comprehensive <span className="text-white font-bold inline-flex items-center gap-1"><Orbit size={14} /> 360°</span> analytics architecture</p>
           </div>
        </div>

        <div className="p-8 space-y-8">
           <div className="space-y-4">
             <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-primary-deep" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dimension Setting</label>
             </div>
             <Select
               value={filters.reportType}
               onValueChange={(val) => setFilters(f => ({ ...f, reportType: val }))}
             >
               <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                 <SelectValue placeholder={selectPlaceholder('Dimension')} />
               </SelectTrigger>
               <SelectContent className="rounded-2xl border-slate-100 shadow-2xl p-1">
                 <SelectItem value="Business Overview" className="rounded-xl py-3 font-bold">
                    <span className="flex items-center gap-2">Business Overview</span>
                 </SelectItem>
                 <SelectItem value="Recovery Value" className="rounded-xl py-3 font-bold text-slate-600">Recovery Value</SelectItem>
                 <SelectItem value="Recovery Volume" className="rounded-xl py-3 font-bold text-slate-600">Recovery Volume</SelectItem>
                 <SelectItem value="Section 360 Degree" className="rounded-xl py-3 font-bold text-slate-600">
                    <span className="flex items-center gap-2">
                       <Orbit size={14} className="text-slate-400 group-hover:text-primary-deep" />
                       Section 360° Perspective
                    </span>
                 </SelectItem>
               </SelectContent>
             </Select>
           </div>

           <div className="space-y-4">
             <div className="flex items-center gap-2">
                <Calendar size={14} className="text-primary-deep" />
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temporal Window</label>
             </div>
             <div className="grid grid-cols-2 gap-3">
               {[
                 { id: 'Today', icon: Clock, label: 'Today' },
                 { id: 'This Week', icon: CalendarDays, label: 'Current Week' },
                 { id: 'This Month', icon: Calendar, label: 'Current Month' },
                 { id: 'Last Month', icon: History, label: 'Last Month' }
               ].map((item) => (
                 <button
                   key={item.id}
                   onClick={() => setFilters(f => ({ ...f, sortBy: item.id }))}
                   className={cn(
                     "flex flex-col items-start gap-3 p-4 rounded-2xl border transition-all duration-300 text-left",
                     filters.sortBy === item.id
                       ? "bg-primary-deep text-white border-primary-deep shadow-lg shadow-primary-deep/20 scale-[1.02]"
                       : "bg-white text-slate-500 border-slate-100 hover:border-primary-deep/30 hover:bg-slate-50"
                   )}
                 >
                   <item.icon size={18} className={cn(filters.sortBy === item.id ? "text-white" : "text-slate-300")} />
                   <span className="text-[11px] font-black uppercase tracking-wider">{item.label}</span>
                 </button>
               ))}
             </div>
           </div>
        </div>

        <div className="p-8 pt-0 flex gap-4">
           <Button
             variant="outline"
             onClick={handleReset}
             className="h-14 flex-1 rounded-2xl border-slate-200 font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all"
           >
             Reset Defaults
           </Button>
           <Button
             onClick={handleApply}
             className="h-14 flex-1 bg-primary-deep text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-deep/20 hover:bg-slate-800 transition-all"
           >
             Apply Settings
           </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
