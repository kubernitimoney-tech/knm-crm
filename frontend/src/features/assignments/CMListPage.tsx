import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  X,
  UserPlus,
  Plus,
  Check
} from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from "@/components/ui/table";
import {
  DataTableCustomerNameCell,
  dataTableBodyRowClass,
  dataTableCellClass,
  dataTableActionCellClass,
  dataTableHeadClass,
  dataTableHeaderClass,
  dataTableHeaderRowClass,
  indexCellClass,
  nameCellClass,
  dataTableCardClass,
  dataTableFilterToolbarClass,
  dataTableFilterControlClass,
  DataTableSearchInput,
  DataTableClearFiltersButton,
  DataTableFooter,
  DataTablePageSizeSelect,
} from '@/components/ui/data-table';
import { cn, formatPersonName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { fetchAssignmentRoster, type RosterMember } from '@/lib/pipelineApi';
import { toast } from '@/components/ui/toast';
import {
  DataTableListingActions,
  DataTableActionHead,
  usePermissionActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { usePermissions } from '@/hooks/usePermissions';

type CmRow = RosterMember & { assignedRmIds: string[] };

export function CMListPage() {
  useTitle('CM List');
  const navigate = useNavigate();
  const { canUi } = usePermissions();
  const actionCol = usePermissionActionColumn({
    view: canUi('users', 'user', 'view'),
    edit: canUi('users', 'user', 'update'),
    delete: canUi('users', 'user', 'delete'),
  });
  const tableColSpan = actionCol.showColumn ? 6 : 5;
  const [data, setData] = useState<CmRow[]>([]);
  const [rmOptions, setRmOptions] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [designationFilter, setDesignationFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    Promise.all([fetchAssignmentRoster('cm'), fetchAssignmentRoster('rm')])
      .then(([cms, rms]) => {
        setData(cms.map((cm) => ({ ...cm, assignedRmIds: cm.assignedRmIds ?? [] })));
        setRmOptions(rms.map((rm) => ({ id: rm.id, name: rm.name })));
      })
      .catch(() => {
        setData([]);
        setRmOptions([]);
        toast({ title: 'Failed to load CM list', variant: 'error' });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const designationOptions = useMemo(
    () => Array.from(new Set(data.map((item) => item.designation))).sort(),
    [data]
  );

  const handleToggleStatus = (id: string) => {
    setData(prev => prev.map(item =>
      item.id === id ? { ...item, status: !item.status } : item
    ));
  };

  const handleAssignRM = (cmId: string, rmId: string) => {
    setData(prev => prev.map(item => {
      if (item.id === cmId) {
        const current = item.assignedRmIds || [];
        const updated = current.includes(rmId)
          ? current.filter(id => id !== rmId)
          : [...current, rmId];
        return { ...item, assignedRmIds: updated };
      }
      return item;
    }));
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setDesignationFilter('All');
    setCurrentPage(1);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.designation.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDesignation = designationFilter === 'All' || item.designation === designationFilter;

      return matchesSearch && matchesDesignation;
    });
  }, [data, searchQuery, designationFilter]);

  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">CM List</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">Manage Credit Managers and RM assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-primary-deep text-white hover:bg-primary-deep/90 h-11 text-xs font-bold gap-2 rounded-xl"
          >
            <UserPlus size={16} />
            Add New CM
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name or Designation')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select value={designationFilter} onValueChange={(val) => { setDesignationFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className={cn('w-[160px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Designation')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Designations</SelectItem>
                {designationOptions.map((designation) => (
                  <SelectItem key={designation} value={designation}>{designation}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchQuery !== '' || designationFilter !== 'All') && (
              <DataTableClearFiltersButton onClick={handleClearFilters} />
            )}
          </div>
        </div>

        <Card className={dataTableCardClass}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dataTableHeadClass, 'w-[80px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableHeadClass}>Name</TableHead>
                <TableHead className={dataTableHeadClass}>Designation</TableHead>
                <TableHead className={dataTableHeadClass}>Assign RM</TableHead>
                <TableHead className={cn(dataTableHeadClass, 'w-[120px] text-center')}>Status</TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading credit managers…" />
              ) : paginatedData.length > 0 ? (
                paginatedData.map((item, idx) => (
                  <TableRow key={item.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <DataTableCustomerNameCell label={formatPersonName(item.name)} tone="neutral" />
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{item.designation}</TableCell>
                    <TableCell className={dataTableCellClass}>
                      <Popover>
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[280px]">
                          {(item.assignedRmIds || []).map(rmId => {
                            const rm = rmOptions.find(r => r.id === rmId);
                            if (!rm) return null;
                            return (
                              <Badge
                                key={rmId}
                                variant="secondary"
                                className="h-6 px-2 text-[10px] font-bold rounded-lg border border-slate-200/80 bg-slate-50 text-slate-705 dark:border-slate-800 dark:bg-white/5 dark:text-slate-200 flex items-center gap-1 normal-case tracking-normal"
                              >
                                {formatPersonName(rm.name)}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignRM(item.id, rmId);
                                  }}
                                  className="text-slate-400 hover:text-rose-500 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 p-0.5"
                                >
                                  <X size={10} />
                                </button>
                              </Badge>
                            );
                          })}
                          <PopoverTrigger
                            className="h-6 px-2 text-[10px] font-black rounded-lg border border-dashed border-slate-200 text-slate-600 dark:text-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-white/5 flex items-center gap-1 cursor-pointer bg-transparent"
                          >
                            <Plus size={10} /> Assign RM
                          </PopoverTrigger>
                        </div>
                        <PopoverContent className="w-56 p-2 bg-white dark:bg-[#20223f] border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50">
                          <p className="text-[10px] font-black uppercase text-slate-400 dark:text-[#B0B0C1] tracking-wider px-2 py-1 border-b border-slate-50 dark:border-slate-805 mb-1">
                            Assign Relationship Managers
                          </p>
                          <div className="space-y-0.5 max-h-48 overflow-y-auto">
                            {rmOptions.map(rm => {
                              const isAssigned = (item.assignedRmIds || []).includes(rm.id);
                              return (
                                <button
                                  key={rm.id}
                                  onClick={() => handleAssignRM(item.id, rm.id)}
                                  className={cn(
                                    "w-full text-left px-2.5 py-1.5 text-[11px] font-medium rounded-lg flex items-center justify-between transition-colors",
                                    isAssigned
                                      ? "bg-primary-deep/5 text-primary-deep dark:bg-white/10 dark:text-indigo-300 font-bold"
                                      : "hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"
                                  )}
                                >
                                  <span>{formatPersonName(rm.name)}</span>
                                  {isAssigned && <Check size={12} className="text-primary-deep dark:text-indigo-400" />}
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className={dataTableActionCellClass}>
                      <button
                        onClick={() => handleToggleStatus(item.id)}
                        className={cn(
                          "relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none",
                          item.status ? "bg-emerald-500" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out px-0.5 flex items-center justify-center",
                            item.status ? "translate-x-7" : "translate-x-1"
                          )}
                        >
                          <span className={cn(
                            "text-[6px] font-black uppercase",
                            item.status ? "text-emerald-500" : "text-slate-400"
                          )}>
                            {item.status ? "Y" : "N"}
                          </span>
                        </span>
                        <span className={cn(
                          "absolute text-[9px] font-black uppercase transition-opacity duration-200",
                          item.status ? "left-2 text-white opacity-100" : "right-2 text-slate-500 opacity-0"
                        )}>
                          Yes
                        </span>
                        <span className={cn(
                          "absolute text-[9px] font-black uppercase transition-opacity duration-200",
                          item.status ? "left-2 text-white opacity-0" : "right-2 text-slate-600 opacity-100"
                        )}>
                          No
                        </span>
                      </button>
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        onEdit={() => navigate(`/master/users/${item.id}`)}
                        onDelete={async () => {
                          toast({
                            title: 'Delete not available',
                            description: 'CM removal must be performed from user management.',
                            variant: 'info',
                          });
                        }}
                        deleteTitle="Delete CM?"
                        deleteDescription={`${item.name} will be removed from the CM list.`}
                      />
                    </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4">
                        <Search size={32} />
                      </div>
                      <p className="text-slate-400 font-bold text-sm">No CMs found matching your filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        </Card>

        <DataTableFooter
          inset={false}
          currentPage={currentPage}
          totalItems={filteredData.length}
          pageSize={itemsPerPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo(0, 0);
          }}
          leftExtra={
            <DataTablePageSizeSelect
              value={itemsPerPage}
              onChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          }
        />
      </div>
    </div>
  );
}
