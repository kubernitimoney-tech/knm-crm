import React, { useCallback, useState } from 'react';
import {
  UserPlus,
  Mail,
  Phone,
  ShieldCheck,
  Briefcase,
  Wallet,
  Fingerprint,
} from 'lucide-react';
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
import { FieldLabel, RequiredMark } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { maxDateOfBirth, MIN_BORROWER_AGE_YEARS, parseIsoDate } from '@/lib/dateUtils';
import {
  buildCreateLeadPayload,
  createLead,
  lookupCustomer,
  LeadRateLimitError,
} from '@/lib/leadsApi';
import { LOAN_PURPOSE_OPTIONS } from '@/features/leads/components/leadSanctionConstants';
import { getApiErrorMessage } from '@/lib/api';
import {
  digitsOnly,
  normalizeIndianMobile,
  upperAlphanumeric,
  validateMobile,
  validatePan,
  validateAadhaar,
  firstValidationError,
} from '@/lib/indiaValidators';
import { validateBusinessEmail } from '@/lib/emailValidators';
import { validateNewLeadFinancials } from '@/lib/leadValidation';
import {
  handleDialogOpenChange,
  type DialogChangeEventDetails,
} from '@/lib/dialogCloseUtils';
import { usePincodeAutofill } from '@/hooks/usePincodeAutofill';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/constants/employmentTypes';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

interface AddLeadDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
}

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  mobile: '',
  pan: '',
  aadhaar: '',
  monthlyIncome: '',
  requiredAmount: '',
  dob: '',
  state: '',
  city: '',
  pincode: '',
  gender: '',
  employmentType: '',
  loanPurpose: '',
  acceptedTerms: false,
  consentGiven: false,
};

const inputClassName =
  'h-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800';

export const AddLeadDialog = ({ isOpen, onOpenChange, onAdd }: AddLeadDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const [empSelectOpen, setEmpSelectOpen] = useState(false);
  const [purposeSelectOpen, setPurposeSelectOpen] = useState(false);
  const [genderSelectOpen, setGenderSelectOpen] = useState(false);

  const { lookupPincode, isLookingUp: isPincodeLookingUp } = usePincodeAutofill();
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);

  const anySelectOpen = empSelectOpen || purposeSelectOpen || genderSelectOpen;

  const dismissDialog = useCallback(() => {
    setError('');
    setPincodeLookupError(null);
    setFormData({ ...EMPTY_FORM });
    setEmpSelectOpen(false);
    setPurposeSelectOpen(false);
    setGenderSelectOpen(false);
  }, []);

  const closeDialog = useCallback(() => {
    dismissDialog();
    onOpenChange(false);
  }, [dismissDialog, onOpenChange]);

  const handlePincodeChange = (value: string) => {
    const pincode = digitsOnly(value, 6);
    setFormData((prev) => ({ ...prev, pincode }));
    setPincodeLookupError(null);
    lookupPincode(
      pincode,
      (details) => {
        setFormData((prev) => ({
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

  const validateForm = () => {
    if (!formData.firstName.trim()) return 'First name is required.';
    const mobileError = validateMobile(formData.mobile, { required: true });
    if (mobileError) return mobileError;
    if (!formData.email.trim()) return 'Email is required.';
    const emailError = validateBusinessEmail(formData.email, { required: true });
    if (emailError) return emailError;

    const pan = upperAlphanumeric(formData.pan, 10);
    const aadhaar = digitsOnly(formData.aadhaar, 12);
    if (!pan && !aadhaar) return 'Either PAN or Aadhaar number is required.';
    const identityError = firstValidationError(
      pan ? validatePan(pan) : null,
      aadhaar ? validateAadhaar(aadhaar) : null,
    );
    if (identityError) return identityError;

    const financialError = validateNewLeadFinancials(
      formData.monthlyIncome,
      formData.requiredAmount,
    );
    if (financialError) return financialError;

    if (!formData.dob) return 'Date of birth is required.';
    const dobDate = parseIsoDate(formData.dob);
    const maxDob = maxDateOfBirth();
    if (dobDate && dobDate > maxDob) {
      return `Customer must be at least ${MIN_BORROWER_AGE_YEARS} years old.`;
    }
    if (!formData.state.trim()) return 'State is required.';
    if (!formData.city.trim()) return 'City is required.';
    const pincode = digitsOnly(formData.pincode, 6);
    if (pincode.length !== 6) return 'A valid 6-digit pincode is required.';
    if (!formData.gender) return 'Gender is required.';
    if (!formData.employmentType) return 'Employment type is required.';
    if (!formData.loanPurpose) return 'Loan purpose is required.';
    if (!formData.acceptedTerms) return 'You must accept the terms and conditions.';
    if (!formData.consentGiven) return 'Customer consent is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const pan = upperAlphanumeric(formData.pan, 10);
    const aadhaar = digitsOnly(formData.aadhaar, 12);
    const mobile = normalizeIndianMobile(formData.mobile);
    const pincode = digitsOnly(formData.pincode, 6);

    setIsLoading(true);
    try {
      const lookup = await lookupCustomer({
        pan: pan || undefined,
        aadhaar: aadhaar || undefined,
        email: formData.email.trim(),
        mobile,
      });

      if (lookup.exists && lookup.can_create_lead === false) {
        toast({
          title: 'Lead limit reached',
          description: 'Maximum 2 leads per customer per hour. Please try again later.',
          variant: 'error',
          duration: 8000,
        });
        return;
      }

      if (lookup.exists && lookup.active_lead) {
        const rmName = lookup.active_lead.assigned_rm_name ?? 'the assigned team';
        const rmEmail = lookup.active_lead.assigned_rm_email;
        toast({
          title: 'Existing enquiry found',
          description: rmEmail
            ? `Another lead is in progress with ${rmName} (${rmEmail}). Creating a new lead anyway.`
            : `Another lead is in progress with ${rmName}. Creating a new lead anyway.`,
          variant: 'info',
          duration: 6000,
        });
      }

      await createLead(
        buildCreateLeadPayload({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobile: formData.mobile,
          dob: formData.dob,
          gender: formData.gender,
          pan: pan || undefined,
          aadhaar: aadhaar || undefined,
          requiredAmount: formData.requiredAmount,
          loanPurpose: formData.loanPurpose,
          employment: {
            employment_type: formData.employmentType,
            monthly_salary: Number(formData.monthlyIncome),
          },
          address: {
            city: formData.city,
            state: formData.state,
            pincode,
          },
        }),
      );

      toast({
        title: 'Lead created',
        description: 'The lead has been auto-assigned to a relationship manager.',
        variant: 'success',
      });
      onAdd();
      closeDialog();
    } catch (err) {
      if (err instanceof LeadRateLimitError) {
        toast({
          title: 'Lead limit reached',
          description: err.message,
          variant: 'error',
          duration: 8000,
        });
      } else {
        setError(getApiErrorMessage(err));
      }
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
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col bg-white border-slate-200 rounded-[32px] shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="shrink-0 p-8 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className="w-12 h-12 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep shadow-inner ring-1 ring-primary-deep/10">
            <UserPlus size={24} />
          </div>
          <DialogTitle className="text-2xl font-black text-primary-deep tracking-tight mt-4">
            New Lead Enquiry
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider mt-1">
            Enter customer details to create a new lead
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel variant="dialog" required>First Name</FieldLabel>
                <Input
                  placeholder={enterPlaceholder('First Name')}
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog">Last Name</FieldLabel>
                <Input
                  placeholder={enterPlaceholder('Last Name')}
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Mobile No</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                  <Input
                    type="tel"
                    placeholder={enterPlaceholder('Mobile Number')}
                    maxLength={10}
                    inputMode="numeric"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: digitsOnly(e.target.value, 10) })}
                    className={`${inputClassName} pl-12`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Email</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                  <Input
                    type="email"
                    placeholder={enterPlaceholder('Email Address')}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`${inputClassName} pl-12`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Aadhaar No</FieldLabel>
                <div className="relative">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                  <Input
                    placeholder={enterPlaceholder('Aadhaar Number')}
                    maxLength={12}
                    inputMode="numeric"
                    value={formData.aadhaar}
                    onChange={(e) => setFormData({ ...formData, aadhaar: digitsOnly(e.target.value, 12) })}
                    className={`${inputClassName} pl-12`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>PAN No</FieldLabel>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                  <Input
                    placeholder={enterPlaceholder('PAN Number')}
                    maxLength={10}
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: upperAlphanumeric(e.target.value, 10) })}
                    className={`${inputClassName} pl-12 uppercase font-mono`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Monthly Income (₹)</FieldLabel>
                <Input
                  type="number"
                  min={40000}
                  placeholder={enterPlaceholder('Monthly Income')}
                  value={formData.monthlyIncome}
                  onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Loan Required (₹)</FieldLabel>
                <div className="relative">
                  <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                  <Input
                    type="number"
                    min="1"
                    placeholder={enterPlaceholder('Loan Required')}
                    value={formData.requiredAmount}
                    onChange={(e) => setFormData({ ...formData, requiredAmount: e.target.value })}
                    className={`${inputClassName} pl-12`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>DOB</FieldLabel>
                <DatePicker
                  value={formData.dob}
                  onChange={(dob) => setFormData({ ...formData, dob })}
                  placeholder={selectPlaceholder('Date of Birth')}
                  maxDate={maxDateOfBirth()}
                  fromYear={1940}
                  toYear={maxDateOfBirth().getFullYear()}
                  inDialog
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Gender</FieldLabel>
                <Select
                  modal={false}
                  open={genderSelectOpen}
                  onOpenChange={setGenderSelectOpen}
                  value={formData.gender}
                  onValueChange={(val) => setFormData({ ...formData, gender: val })}
                >
                  <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                    <SelectValue placeholder={selectPlaceholder('Gender')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Pincode</FieldLabel>
                <Input
                  placeholder={enterPlaceholder('PIN Code')}
                  maxLength={6}
                  inputMode="numeric"
                  value={formData.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  className={inputClassName}
                />
                {isPincodeLookingUp && (
                  <p className="text-[10px] font-medium text-primary-deep px-1">Fetching city and state…</p>
                )}
                {pincodeLookupError && (
                  <p className="text-[10px] font-medium text-rose-500 px-1">{pincodeLookupError}</p>
                )}
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>City</FieldLabel>
                <Input
                  placeholder={enterPlaceholder('City')}
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>State</FieldLabel>
                <Input
                  placeholder={enterPlaceholder('State')}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className={inputClassName}
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Employment Type</FieldLabel>
                <div className="relative">
                  <Briefcase className="absolute left-4 z-10 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                  <Select
                    modal={false}
                    open={empSelectOpen}
                    onOpenChange={setEmpSelectOpen}
                    value={formData.employmentType}
                    onValueChange={(val) => setFormData({ ...formData, employmentType: val })}
                  >
                    <SelectTrigger className={cn('w-full pl-12', dataTableFilterControlClass)}>
                      <SelectValue placeholder={selectPlaceholder('Employment Type')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                      {EMPLOYMENT_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <FieldLabel variant="dialog" required>Loan Purpose</FieldLabel>
                <Select
                  modal={false}
                  open={purposeSelectOpen}
                  onOpenChange={setPurposeSelectOpen}
                  value={formData.loanPurpose}
                  onValueChange={(val) => setFormData({ ...formData, loanPurpose: val })}
                >
                  <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                    <SelectValue placeholder={selectPlaceholder('Loan Purpose')} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                    {LOAN_PURPOSE_OPTIONS.map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>{purpose}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-medium px-1">
              Provide at least one of PAN or Aadhaar. Both are stored encrypted.
            </p>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptedTerms}
                  onChange={(e) => setFormData({ ...formData, acceptedTerms: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-deep focus:ring-primary-deep"
                />
                <span className="text-xs text-slate-600 font-medium leading-relaxed">
                  I accept the Terms &amp; Conditions
                  <RequiredMark />
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consentGiven}
                  onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-deep focus:ring-primary-deep"
                />
                <span className="text-xs text-slate-600 font-medium leading-relaxed">
                  Customer has provided consent to process this enquiry and contact them
                  <RequiredMark />
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="shrink-0 p-8 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              data-dialog-dismiss="true"
              onClick={closeDialog}
              className="h-12 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 bg-primary-deep text-white rounded-xl font-bold shadow-lg shadow-primary-deep/20 hover:opacity-95 text-xs px-6"
            >
              {isLoading ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
