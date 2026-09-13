import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTitle } from '@/hooks/useTitle';
import {
  Search,
  UserPlus,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { userStatusBadgeClass } from '@/lib/badgeStyles';
import { Button } from '@/components/ui/button';
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
  dataTableSortableHeadClass,
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
import {
  DataTableListingActions,
  DataTableActionHead,
  useDataTableActionColumn,
} from '@/components/ui/data-table-listing-actions';
import { searchPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import { toast } from '@/components/ui/toast';
import { User } from '@/types';
import { cn, formatPersonName } from '@/lib/utils';
import { AddEmployeeDialog } from '@/components/users/AddEmployeeDialog';
import { fetchUsers, mapApiUserToListItem } from '@/lib/usersApi';
import { usePermissions } from '@/hooks/usePermissions';

const STATUSES: User['status'][] = ['Active', 'Inactive', 'Resigned', 'Absconding'];

export const UsersPage = () => {
  useTitle('System Users');
  const navigate = useNavigate();
  const { canCreateUser, canAssignRoles, canUi } = usePermissions();
  const actionCol = useDataTableActionColumn({
    view: canUi('users', 'user', 'view'),
    edit: canUi('users', 'user', 'update'),
    delete: canUi('users', 'user', 'delete'),
  });
  const tableColSpan = actionCol.showColumn ? 7 : 6;
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'joinedDate',
    direction: 'desc'
  });

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const isActive =
        statusFilter === 'Active' ? true : statusFilter === 'Inactive' ? false : undefined;
      const data = await fetchUsers({
        page: currentPage,
        page_size: itemsPerPage,
        search: searchQuery || undefined,
        is_active: isActive,
      });
      setUsers(data.results.map(mapApiUserToListItem));
      setTotalCount(data.count);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load users');
      setUsers([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, searchQuery, statusFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={12} className="ml-1 opacity-40" />;
    return sortConfig.direction === 'asc' ?
      <ArrowUp size={12} className="ml-1 text-primary-deep" /> :
      <ArrowDown size={12} className="ml-1 text-primary-deep" />;
  };

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'All';

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCurrentPage(1);
  };

  // Stats from current page (server-side list)
  const stats = useMemo(() => {
    return {
      active: users.filter(u => u.status === 'Active').length,
      inactive: users.filter(u => u.status === 'Inactive').length,
      total: totalCount,
    };
  }, [users, totalCount]);

  const filteredAndSortedUsers = useMemo(() => {
    const result = [...users];

    if (sortConfig.key && sortConfig.direction) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof User];
        const bVal = b[sortConfig.key as keyof User];

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, sortConfig]);

  const paginatedUsers = filteredAndSortedUsers;

  const getStatusBadge = (status: User['status']) => (
    <Badge className={userStatusBadgeClass(status)}>{status}</Badge>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Breadcrumbs />
          <h1 className="text-[22px] font-black text-primary-deep leading-tight">Employee Directory</h1>
          <p className="text-mid-shade text-xs mt-1 font-medium italic">Manage workforce access and monitoring</p>
        </div>
        {canCreateUser && (
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="h-11 bg-primary-deep text-white rounded-xl shadow-lg shadow-primary-deep/20 px-6 font-bold gap-2 hover:opacity-95 transition-all"
          >
            <UserPlus size={18} />
            Add New Employee
          </Button>
        )}
      </div>

      <AddEmployeeDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        canAssignRoles={canAssignRoles}
        onAdd={() => {
          void loadUsers();
        }}
      />

      {loadError && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-600">
          {loadError}
        </div>
      )}

      <div className="space-y-3">
        <div className={dataTableFilterToolbarClass}>
          <DataTableSearchInput
            placeholder={searchPlaceholder('Name', 'Email', 'or Employee ID')}
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
          />

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
              <SelectTrigger className={cn('w-[160px]', dataTableFilterControlClass)}>
                <SelectValue placeholder={selectPlaceholder('Status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Resigned">Resigned</SelectItem>
                <SelectItem value="Absconding">Absconding</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <DataTableClearFiltersButton onClick={handleClearFilters} />
            )}
          </div>
        </div>

        <Card className={dataTableCardClass}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={dataTableHeaderClass}>
              <TableRow className={dataTableHeaderRowClass}>
                <TableHead className={cn(dataTableHeadClass, 'w-[60px] pl-4 text-center')}>S.No</TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('name')}>
                  <div className="flex items-center">Employee Info {getSortIcon('name')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('role')}>
                  <div className="flex items-center">Role {getSortIcon('role')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('status')}>
                  <div className="flex items-center">Status {getSortIcon('status')}</div>
                </TableHead>
                <TableHead className={dataTableSortableHeadClass} onClick={() => handleSort('joinedDate')}>
                  <div className="flex items-center">Joined On {getSortIcon('joinedDate')}</div>
                </TableHead>
                <TableHead className={dataTableHeadClass}>Last Activity</TableHead>
                <DataTableActionHead visible={actionCol.showColumn} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingRow colSpan={tableColSpan} message="Loading users…" />
              ) : paginatedUsers.length > 0 ? (
                paginatedUsers.map((user, idx) => (
                  <TableRow key={user.id} className={dataTableBodyRowClass}>
                    <TableCell className={indexCellClass}>
                      {(currentPage - 1) * itemsPerPage + idx + 1}
                    </TableCell>
                    <TableCell className={nameCellClass}>
                      <div className="flex flex-col gap-0.5">
                        <DataTableCustomerNameCell label={formatPersonName(user.name)} tone="neutral" />
                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{user.employeeId} • {user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className={dataTableCellClass}>{user.role}</TableCell>
                    <TableCell className={dataTableCellClass}>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className={dataTableCellClass}>{user.joinedDate}</TableCell>
                    <TableCell className={dataTableCellClass}>
                      <div className="flex items-center gap-1.5">
                         <Clock size={12} />
                         {user.lastLogin}
                      </div>
                    </TableCell>
                    {actionCol.showColumn && (
                    <TableCell className={dataTableActionCellClass}>
                      <DataTableListingActions
                        visibility={actionCol}
                        viewTo={`/master/users/${user.id}`}
                        onEdit={() => navigate(`/master/users/${user.id}`)}
                        onDelete={async () => {
                          toast({
                            title: 'Delete not available',
                            description: 'User deletion must be performed from the admin console.',
                            variant: 'info',
                          });
                        }}
                        viewTitle="View Profile"
                        editTitle="Edit Details"
                        deleteTitle="Delete user?"
                        deleteDescription={`${user.name} will be permanently removed.`}
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
                      <p className="text-slate-400 font-bold text-sm">No users match your criteria</p>
                      <button onClick={handleClearFilters} className="text-primary-deep text-xs font-bold mt-2 hover:underline">Clear all filters</button>
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
          totalItems={totalCount}
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
};
