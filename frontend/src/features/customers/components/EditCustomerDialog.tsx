import React, { useEffect, useState } from 'react';
import { PenLine, User as UserIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from '@/components/ui/toast';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { EDIT_DIALOG_ICON_WRAP_CLASS } from '@/lib/uiTokens';
import {
  updateCustomerProfile,
  type ApiCustomer,
  type CustomerProfile,
} from '@/lib/customersApi';
import {
  digitsOnly,
  normalizeIndianMobile,
  upperAlphanumeric,
  validateMobile,
  validatePan,
  validateAadhaar,
  validatePincode,
  firstValidationError,
} from '@/lib/indiaValidators';
import { validateBusinessEmail } from '@/lib/emailValidators';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';
import {
  handleDialogOpenChange,
  type DialogChangeEventDetails,
} from '@/lib/dialogCloseUtils';
import { usePincodeAutofill } from '@/hooks/usePincodeAutofill';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/constants/employmentTypes';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

interface EditCustomerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  customer: ApiCustomer | null;
  focusLeadId?: string;
  onUpdated: (profile: CustomerProfile) => void;
}

function buildFormState(customer: ApiCustomer) {
  return {
    firstName: customer.first_name ?? '',
    lastName: customer.last_name ?? '',
    email: customer.email ?? '',
    mobile: customer.mobile_number ?? '',
    gender: customer.gender ?? '',
    dob: customer.dob ?? '',
    pan: customer.pan_no ?? '',
    aadhaar: customer.aadhaar_no ?? '',
    employmentType: customer.employment_type ?? '',
    monthlyIncome:
      customer.monthly_income != null && customer.monthly_income !== ''
        ? String(customer.monthly_income)
        : '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    pincode: customer.pincode ?? '',
  };
}

export function EditCustomerDialog({
  isOpen,
  onOpenChange,
  customer,
  focusLeadId,
  onUpdated,
}: EditCustomerDialogProps) {
  const [form, setForm] = useState(buildFormState(customer ?? ({} as ApiCustomer)));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [genderSelectOpen, setGenderSelectOpen] = useState(false);
  const [empSelectOpen, setEmpSelectOpen] = useState(false);
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);
  const { lookupPincode, isLookingUp: isPincodeLookingUp } = usePincodeAutofill();
  const anySelectOpen = genderSelectOpen || empSelectOpen;

  useEffect(() => {
    if (!isOpen || !customer) return;
    setError('');
    setPincodeLookupError(null);
    setForm(buildFormState(customer));
  }, [isOpen, customer]);

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

  const dismissDialog = () => {
    setGenderSelectOpen(false);
    setEmpSelectOpen(false);
    setError('');
  };

  const closeDialog = () => {
    dismissDialog();
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const validationError = firstValidationError(
      validateBusinessEmail(form.email, { required: true, label: 'Email' }),
      validateMobile(form.mobile, { required: true }),
      validatePan(form.pan, { required: false }),
      validateAadhaar(form.aadhaar, { required: false }),
      validatePincode(form.pincode, { required: false }),
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const profile = await updateCustomerProfile(
        customer.id,
        {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email.trim(),
          mobile_number: normalizeIndianMobile(form.mobile),
          gender: form.gender || '',
          dob: form.dob || null,
          pan_no: upperAlphanumeric(form.pan, 10),
          aadhaar_no: digitsOnly(form.aadhaar, 12),
          employment_type: form.employmentType || '',
          monthly_income: form.monthlyIncome ? Number(form.monthlyIncome) : null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: digitsOnly(form.pincode, 6),
        },
        focusLeadId,
      );
      toast({
        title: 'Customer updated',
        description: `${customer.customer_code} profile saved successfully.`,
        variant: 'success',
      });
      onUpdated(profile);
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      modal="trap-focus"
      onOpenChange={(open, eventDetails) => {
        handleDialogOpenChange(open, eventDetails as DialogChangeEventDetails, {
          selectOpen: anySelectOpen,
          onOpenChange,
          onDismiss: dismissDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col bg-white border-slate-200 rounded-[28px] shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="shrink-0 p-7 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center ring-1 ring-amber-200 dark:ring-amber-800', EDIT_DIALOG_ICON_WRAP_CLASS)}>
            <PenLine size={20} />
          </div>
          <DialogTitle className="text-xl font-black text-primary-deep tracking-tight mt-3">
            Edit Customer Profile
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider mt-1">
            {customer ? `${customer.customer_code} • Super Admin only` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {error && (
            <div className="mx-7 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto p-7 space-y-6">
            <section className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <UserIcon size={12} />
                Personal Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    First Name
                  </Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Last Name
                  </Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Mobile</FieldLabel>
                  <Input
                    value={form.mobile}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, mobile: digitsOnly(e.target.value, 10) }))
                    }
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Gender
                  </Label>
                  <Select
                    modal={false}
                    open={genderSelectOpen}
                    onOpenChange={setGenderSelectOpen}
                    value={form.gender}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}
                  >
                    <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                      <SelectValue placeholder={selectPlaceholder('Gender')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Date of Birth
                  </Label>
                  <DatePicker
                    value={form.dob}
                    onChange={(value) => setForm((prev) => ({ ...prev, dob: value }))}
                    className="h-11 w-full bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                    inDialog
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Identity
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    PAN
                  </Label>
                  <Input
                    value={form.pan}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, pan: upperAlphanumeric(e.target.value, 10) }))
                    }
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold font-mono uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Aadhaar
                  </Label>
                  <Input
                    value={form.aadhaar}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, aadhaar: digitsOnly(e.target.value, 12) }))
                    }
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold font-mono"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Employment & Income
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Employment Type
                  </Label>
                  <Select
                    modal={false}
                    open={empSelectOpen}
                    onOpenChange={setEmpSelectOpen}
                    value={form.employmentType}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, employmentType: value }))}
                  >
                    <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                      <SelectValue placeholder={selectPlaceholder('Employment Type')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                      {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    Monthly Income
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.monthlyIncome}
                    onChange={(e) => setForm((prev) => ({ ...prev, monthlyIncome: e.target.value }))}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                    placeholder={enterPlaceholder('Monthly Income')}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Address
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    PIN Code
                  </Label>
                  <Input
                    value={form.pincode}
                    onChange={(e) => handlePincodeChange(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    placeholder={enterPlaceholder('PIN Code')}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                  {isPincodeLookingUp && (
                    <p className="text-[10px] font-medium text-primary-deep px-1">Fetching city and state…</p>
                  )}
                  {pincodeLookupError && (
                    <p className="text-[10px] font-medium text-rose-500 px-1">{pincodeLookupError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    City
                  </Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    State
                  </Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-7 py-4 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              data-dialog-dismiss="true"
              className="h-10 rounded-xl text-xs font-bold"
              onClick={closeDialog}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 rounded-xl bg-primary-deep hover:bg-primary-deep/90 text-xs font-bold"
              disabled={isLoading}
            >
              {isLoading ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
