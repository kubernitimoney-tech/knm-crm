import React, { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  createLeadAddress,
  deleteLeadAddress,
  fetchLeadAddresses,
  updateLeadAddress,
  type ApiLeadAddress,
} from '@/lib/leadDetailsApi';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableLoadingRow,
} from '@/components/ui/table';
import {
  AnimatedAddFormPanel,
  EditDeleteActions,
  EmptyTableRow,
  EntryStatus,
  FormFieldLabel,
  FormSelect,
  SectionTable,
  StatusBadge,
  sectionHeadClassName,
  sectionCellClassName,
  binaryStatusOptions,
  textareaClassName,
  useAnimatedFormPanel,
} from '@/features/leads/components/leadDetailSectionShared';
import { cn } from '@/lib/utils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import {
  digitsOnly,
  validatePincode,
} from '@/lib/indiaValidators';
import { usePincodeAutofill } from '@/hooks/usePincodeAutofill';
import {
  ADDRESS_TYPE_OPTIONS,
  addressTypeLabel,
  normalizeAddressTypeSlug,
  type AddressTypeSlug,
} from '@/constants/addressTypes';

export type AddressType = AddressTypeSlug;

export interface LeadAddressEntry {
  id: string;
  addressType: AddressType;
  pincode: string;
  state: string;
  city: string;
  address: string;
  status: EntryStatus;
}

const emptyForm = (): Omit<LeadAddressEntry, 'id' | 'addressType' | 'status'> & {
  addressType: AddressType | '';
  status: EntryStatus | '';
} => ({
  addressType: '',
  pincode: '',
  state: '',
  city: '',
  address: '',
  status: '',
});

function mapApiAddress(entry: ApiLeadAddress): LeadAddressEntry {
  return {
    id: entry.id,
    addressType: normalizeAddressTypeSlug(entry.address_type || entry.address_type_display),
    pincode: entry.pincode,
    state: entry.state,
    city: entry.city,
    address: entry.address,
    status: entry.status,
  };
}

interface LeadAddressDetailsSectionProps {
  leadId: string;
  canAdd?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onVerificationChange?: () => void | Promise<void>;
}

export function LeadAddressDetailsSection({
  leadId,
  canAdd = false,
  canEdit = false,
  canDelete = false,
  onVerificationChange,
}: LeadAddressDetailsSectionProps) {
  const showActionColumn = canEdit || canDelete;
  const tableColSpan = showActionColumn ? 7 : 6;
  const [entries, setEntries] = useState<LeadAddressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);
  const { lookupPincode, isLookingUp: isPincodeLookingUp } = usePincodeAutofill();
  const { showForm, formError, setFormError, openForm, closeForm } = useAnimatedFormPanel();

  const loadEntries = useCallback(async () => {
    if (!leadId) return;
    setIsLoading(true);
    try {
      const data = await fetchLeadAddresses(leadId);
      setEntries(data.map(mapApiAddress));
    } catch (err) {
      toast({
        title: 'Failed to load addresses',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setFormError(null);
    setPincodeLookupError(null);
  };

  const handlePincodeChange = (value: string) => {
    const pincode = digitsOnly(value, 6);
    setForm((prev) => ({ ...prev, pincode }));
    setPincodeLookupError(null);
    lookupPincode(
      pincode,
      (details) => {
        setForm((prev) => ({
          ...prev,
          pincode: details.pincode,
          city: details.city,
          state: details.state,
        }));
        setPincodeLookupError(null);
      },
      setPincodeLookupError,
    );
  };

  const handleOpen = () => {
    resetForm();
    openForm();
  };

  const handleClose = () => {
    closeForm(resetForm);
  };

  const handleSubmit = async () => {
    if (!form.addressType) {
      setFormError('Please select address type.');
      return;
    }
    if (!form.status) {
      setFormError('Please select status.');
      return;
    }
    if (!form.state.trim() || !form.city.trim() || !form.address.trim()) {
      setFormError('State, city, and address are required.');
      return;
    }
    const pincodeError = validatePincode(form.pincode, { required: true });
    if (pincodeError) {
      setFormError(pincodeError);
      return;
    }
    const pincode = digitsOnly(form.pincode, 6);

    try {
      if (editingId) {
        const updated = await updateLeadAddress(leadId, editingId, {
          addressType: form.addressType as AddressType,
          pincode,
          state: form.state,
          city: form.city,
          address: form.address,
          status: form.status as EntryStatus,
        });
        setEntries((prev) =>
          prev.map((entry) => (entry.id === editingId ? mapApiAddress(updated) : entry)),
        );
      } else {
        const created = await createLeadAddress(leadId, {
          addressType: form.addressType as AddressType,
          pincode,
          state: form.state,
          city: form.city,
          address: form.address,
          status: form.status as EntryStatus,
        });
        setEntries((prev) => [mapApiAddress(created), ...prev]);
      }
      closeForm(resetForm);
      await onVerificationChange?.();
      toast({ title: editingId ? 'Address updated' : 'Address added', variant: 'success' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    }
  };

  const handleEdit = (entry: LeadAddressEntry) => {
    setEditingId(entry.id);
    setFormError(null);
    setPincodeLookupError(null);
    setForm({
      addressType: entry.addressType,
      pincode: entry.pincode,
      state: entry.state,
      city: entry.city,
      address: entry.address,
      status: entry.status,
    });
    openForm();
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteLeadAddress(leadId, entryId);
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      if (editingId === entryId) {
        closeForm(resetForm);
      }
      await onVerificationChange?.();
      toast({ title: 'Address deleted', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <AnimatedAddFormPanel
        showForm={showForm}
        onOpen={handleOpen}
        onClose={handleClose}
        addButtonLabel="Add Address"
        formTitle={editingId ? 'Edit Address' : 'Add Address'}
        submitLabel={editingId ? 'Update Address' : 'Save Address'}
        onSubmit={handleSubmit}
        formError={formError}
        description="Manage customer addresses for this lead."
        showAddButton={canAdd}
      >
        {showForm ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1">
            <FormFieldLabel required>Address Type</FormFieldLabel>
            <FormSelect
              key={`address-type-${editingId ?? 'new'}`}
              value={form.addressType}
              onChange={(addressType) =>
                setForm((prev) => ({ ...prev, addressType: addressType as AddressType | '' }))
              }
              placeholder={selectPlaceholder('Address Type')}
              options={ADDRESS_TYPE_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Pincode</FormFieldLabel>
            <Input
              value={form.pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('Pincode')}
              maxLength={6}
              inputMode="numeric"
            />
            {isPincodeLookingUp && (
              <p className="text-[10px] text-primary-deep">Fetching city and state…</p>
            )}
            {pincodeLookupError && (
              <p className="text-[10px] text-rose-500">{pincodeLookupError}</p>
            )}
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>State</FormFieldLabel>
            <Input
              value={form.state}
              onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('State')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>City</FormFieldLabel>
            <Input
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              className="h-8 text-[11px]"
              placeholder={enterPlaceholder('City')}
            />
          </div>
          <div className="space-y-1">
            <FormFieldLabel required>Status</FormFieldLabel>
            <FormSelect
              key={`status-${editingId ?? 'new'}`}
              value={form.status}
              onChange={(status) =>
                setForm((prev) => ({ ...prev, status: status as EntryStatus | '' }))
              }
              placeholder={selectPlaceholder('Status')}
              options={binaryStatusOptions()}
            />
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-3">
            <FormFieldLabel required>Address</FormFieldLabel>
            <textarea
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className={textareaClassName}
              placeholder={enterPlaceholder('Address')}
            />
          </div>
        </div>
        ) : null}
      </AnimatedAddFormPanel>

      <SectionTable>
        <TableHeader className="bg-slate-50/80 dark:bg-slate-950/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className={sectionHeadClassName()}>Address Type</TableHead>
            <TableHead className={sectionHeadClassName()}>Pincode</TableHead>
            <TableHead className={sectionHeadClassName()}>State</TableHead>
            <TableHead className={sectionHeadClassName()}>City</TableHead>
            <TableHead className={sectionHeadClassName()}>Address</TableHead>
            <TableHead className={sectionHeadClassName()}>Status</TableHead>
            {showActionColumn && (
            <TableHead className={sectionHeadClassName('text-center')}>Action</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableLoadingRow colSpan={tableColSpan} message="Loading addresses…" compact />
          ) : entries.length === 0 ? (
            <EmptyTableRow colSpan={tableColSpan} message="No addresses added yet." />
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className="border-b border-slate-50 dark:border-slate-850">
                <TableCell className={sectionCellClassName}>
                  {addressTypeLabel(entry.addressType)}
                </TableCell>
                <TableCell className={sectionCellClassName}>{entry.pincode}</TableCell>
                <TableCell className={sectionCellClassName}>{entry.state}</TableCell>
                <TableCell className={sectionCellClassName}>{entry.city}</TableCell>
                <TableCell className={cn(sectionCellClassName, 'max-w-[200px]')}>
                  <span className="line-clamp-2">{entry.address}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={entry.status} />
                </TableCell>
                {showActionColumn && (
                <TableCell>
                  <EditDeleteActions
                    onEdit={() => handleEdit(entry)}
                    onDelete={() => handleDelete(entry.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    deleteTitle="Delete this address?"
                    deleteDescription="This address will be permanently removed from the lead."
                  />
                </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </SectionTable>
    </div>
  );
}
