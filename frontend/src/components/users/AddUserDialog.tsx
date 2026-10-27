import React, { useState, useEffect, useMemo, type SyntheticEvent } from 'react';
import {
  UserPlus,
  Mail,
  User as UserIcon,
  AtSign,
  Briefcase,
  Phone,
  MapPin,
  Building2,
  KeyRound,
  Copy,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Paperclip,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import {
  createUser,
  fetchAssignableRoles,
  suggestUsername,
  type AssignableRole,
  type CreatedUser,
} from '@/lib/usersApi';
import { fetchBranches, type ApiBranch } from '@/lib/branchesApi';
import { digitsOnly, normalizeIndianMobile, validateMobile } from '@/lib/indiaValidators';
import { validateBusinessEmail } from '@/lib/emailValidators';
import { validatePasswordPolicy } from '@/lib/passwordPolicy';
import {
  APPROVAL_ATTACHMENT_ACCEPT,
  validateApprovalAttachment,
} from '@/lib/approvalAttachment';
import {
  handleDialogOpenChange,
  type DialogChangeEventDetails,
} from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

interface AddUserDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canAssignRoles: boolean;
  onAdd: () => void;
}

const STEP_TITLES = [
  'Step 1: Login & Identity',
  'Step 2: Contact & Branch',
  'Step 3: Role',
  'Step 4: Approval',
];
const TOTAL_STEPS = STEP_TITLES.length;

const INPUT_CLASS =
  'h-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800';
const ICON_INPUT_CLASS = cn(INPUT_CLASS, 'pl-12');
const ICON_CLASS = 'absolute left-4 top-1/2 -translate-y-1/2 text-slate-450';

const EMPTY_FORM = {
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  displayName: '',
  password: '',
  mobile: '',
  branchId: '',
  address: '',
  role: '',
  requestRemarks: '',
};

/** Same rules as the backend: lowercase local part, a-z 0-9 . _ only. */
function usernameBaseFromEmail(email: string): string {
  const local = email.trim().toLowerCase().split('@')[0] ?? '';
  const base = local
    .replace(/[^a-z0-9._]+/g, '')
    .replace(/[._]{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 26)
    .replace(/[._]+$/, '');
  return base || 'user';
}

function defaultRequestRemarks(name: string, email: string, roleName: string, branchName: string) {
  return (
    `New CRM user ${name || '—'} (${email || '—'}) created with role ${roleName || '—'} `
    + `for branch ${branchName || '—'}, as per the attached approval mail. `
    + 'Requesting review and approval to activate login access.'
  );
}

export const AddUserDialog = ({
  isOpen,
  onOpenChange,
  canAssignRoles,
  onAdd,
}: AddUserDialogProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [branches, setBranches] = useState<ApiBranch[]>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);
  const [branchSelectOpen, setBranchSelectOpen] = useState(false);
  const [serverUsername, setServerUsername] = useState<{ email: string; username: string } | null>(null);
  const [remarksEdited, setRemarksEdited] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const update = (patch: Partial<typeof EMPTY_FORM>) => setFormData((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (!isOpen) return;
    fetchBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
    if (canAssignRoles) {
      fetchAssignableRoles()
        .then(setAssignableRoles)
        .catch(() => setAssignableRoles([]));
    }
  }, [isOpen, canAssignRoles]);

  // Live username preview: instant local guess, then the server's unique pick.
  const emailIsValid = !validateBusinessEmail(formData.email, { required: true, label: 'Email' });
  useEffect(() => {
    if (!isOpen || !emailIsValid) return;
    const email = formData.email.trim().toLowerCase();
    const timer = window.setTimeout(() => {
      suggestUsername(email)
        .then((username) => setServerUsername({ email, username }))
        .catch(() => setServerUsername(null));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isOpen, emailIsValid, formData.email]);

  const usernamePreview = useMemo(() => {
    const email = formData.email.trim().toLowerCase();
    if (!email.includes('@')) return '';
    if (serverUsername?.email === email) return serverUsername.username;
    return usernameBaseFromEmail(email);
  }, [formData.email, serverUsername]);

  const fullName = [formData.firstName, formData.lastName].map((part) => part.trim()).filter(Boolean).join(' ');
  const roleName = assignableRoles.find((role) => role.slug === formData.role)?.name ?? '';
  const branchName = branches.find((branch) => branch.id === formData.branchId)?.branch_name ?? '';

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      return (
        validateBusinessEmail(formData.email, { required: true, label: 'Email' })
        ?? (formData.firstName.trim() ? null : 'First name is required.')
        ?? (formData.password ? validatePasswordPolicy(formData.password) : null)
      );
    }
    if (step === 2) {
      return (
        validateMobile(formData.mobile, { required: true, label: 'Mobile number' })
        ?? (formData.branchId ? null : 'Select a branch.')
      );
    }
    if (step === 3) {
      return canAssignRoles && !formData.role ? 'Select a role for the new user.' : null;
    }
    if (step === 4) {
      if (!attachment) return 'Upload the approval mail or document.';
      return (
        validateApprovalAttachment(attachment)
        ?? (formData.requestRemarks.trim().length >= 10
          ? null
          : 'Request remarks must be at least 10 characters.')
      );
    }
    return null;
  };

  const handleNext = () => {
    const validationError = validateStep(currentStep);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    const nextStep = Math.min(currentStep + 1, TOTAL_STEPS);
    if (nextStep === TOTAL_STEPS && !remarksEdited) {
      update({ requestRemarks: defaultRequestRemarks(fullName, formData.email.trim().toLowerCase(), roleName, branchName) });
    }
    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentStep < TOTAL_STEPS) {
      handleNext();
      return;
    }
    for (let step = 1; step <= TOTAL_STEPS; step += 1) {
      const validationError = validateStep(step);
      if (validationError) {
        setError(validationError);
        setCurrentStep(step);
        return;
      }
    }

    setError('');
    setIsLoading(true);
    try {
      const user = await createUser({
        email: formData.email.trim().toLowerCase(),
        first_name: formData.firstName.trim(),
        middle_name: formData.middleName.trim(),
        last_name: formData.lastName.trim(),
        display_name: formData.displayName.trim(),
        password: formData.password || undefined,
        mobile_number: normalizeIndianMobile(formData.mobile),
        branch: formData.branchId,
        address: formData.address.trim(),
        role_slug: canAssignRoles ? formData.role : undefined,
        attachment: attachment!,
        request_remarks: formData.requestRemarks.trim(),
      });
      setCreated(user);
      onAdd();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setCurrentStep(1);
    setError('');
    setAttachment(null);
    setRoleSelectOpen(false);
    setBranchSelectOpen(false);
    setServerUsername(null);
    setRemarksEdited(false);
    setCreated(null);
    setFormData(EMPTY_FORM);
  };

  const closeDialog = () => {
    resetDialog();
    onOpenChange(false);
  };

  const copyTemporaryPassword = async () => {
    if (!created?.temporary_password) return;
    try {
      await navigator.clipboard.writeText(created.temporary_password);
      toast({ title: 'Copied to clipboard', variant: 'success' });
    } catch {
      toast({ title: 'Could not copy password', variant: 'error' });
    }
  };

  return (
    <Dialog
      open={isOpen}
      modal="trap-focus"
      onOpenChange={(open, eventDetails: DialogChangeEventDetails) => {
        handleDialogOpenChange(open, eventDetails, {
          selectOpen: roleSelectOpen || branchSelectOpen,
          onOpenChange,
          onDismiss: resetDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col bg-white border-slate-200 rounded-[32px] shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="shrink-0 p-8 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep shadow-inner ring-1 ring-primary-deep/10">
              <UserPlus size={24} />
            </div>
            {!created && (
              <div className="flex gap-1.5 items-center">
                {STEP_TITLES.map((_, index) => {
                  const step = index + 1;
                  return (
                    <div
                      key={step}
                      className={cn(
                        'w-2.5 h-2.5 rounded-full transition-all duration-300',
                        step === currentStep
                          ? 'bg-primary-deep w-6'
                          : step < currentStep
                            ? 'bg-emerald-500'
                            : 'bg-slate-200',
                      )}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <DialogTitle className="text-2xl font-black text-primary-deep tracking-tight mt-4">
            {created ? 'User Sent for Approval' : 'Add CRM User'}
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider mt-1">
            {created ? 'Login stays disabled until an approver activates it' : STEP_TITLES[currentStep - 1]}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-5 animate-in fade-in duration-300">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                <p className="text-xs font-semibold text-emerald-700 leading-relaxed">
                  <span className="font-black">{created.full_name}</span> was created as{' '}
                  <span className="font-mono font-black">{created.username}</span>. A different
                  approver must approve the request before the user can sign in.
                </p>
              </div>

              {created.temporary_password ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <KeyRound size={14} />
                    Temporary Password
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold text-slate-800">
                      {created.temporary_password}
                    </code>
                    <Button type="button" variant="outline" size="icon" onClick={copyTemporaryPassword} title="Copy password">
                      <Copy size={16} />
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Shown only once. Share it securely; the user must set their own password at
                    first sign-in, and it expires 72 hours after approval.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-medium">
                  The password you entered is temporary: the user must change it at first sign-in.
                </p>
              )}
            </div>
            <DialogFooter className="shrink-0 p-8 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                onClick={closeDialog}
                className="h-12 bg-primary-deep text-white rounded-xl font-bold shadow-lg shadow-primary-deep/20 hover:opacity-95 text-xs px-6"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
          <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-5">
          {error && (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Email</FieldLabel>
                  <div className="relative">
                    <Mail className={ICON_CLASS} size={16} />
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder={enterPlaceholder('Email')}
                      value={formData.email}
                      onChange={(e) => update({ email: e.target.value })}
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel variant="dialog">Username</FieldLabel>
                  <div className="relative">
                    <AtSign className={ICON_CLASS} size={16} />
                    <Input
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                      value={usernamePreview}
                      placeholder="Generated from email"
                      className={cn(ICON_INPUT_CLASS, 'bg-slate-100/70 text-slate-500 cursor-default focus-visible:ring-0 focus-visible:border-slate-200')}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Auto-generated from the email.</p>
                </div>

                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>First Name</FieldLabel>
                  <div className="relative">
                    <UserIcon className={ICON_CLASS} size={16} />
                    <Input
                      placeholder={enterPlaceholder('First Name')}
                      value={formData.firstName}
                      onChange={(e) => update({ firstName: e.target.value })}
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <FieldLabel variant="dialog">Middle Name</FieldLabel>
                  <Input
                    placeholder={enterPlaceholder('Middle Name')}
                    value={formData.middleName}
                    onChange={(e) => update({ middleName: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel variant="dialog">Last Name</FieldLabel>
                  <Input
                    placeholder={enterPlaceholder('Last Name')}
                    value={formData.lastName}
                    onChange={(e) => update({ lastName: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel variant="dialog">Display Name</FieldLabel>
                  <Input
                    placeholder={enterPlaceholder('Display Name')}
                    value={formData.displayName}
                    onChange={(e) => update({ displayName: e.target.value })}
                    className={INPUT_CLASS}
                  />
                  <p className="text-[10px] text-slate-400 font-medium">Shown in navbar, sidebar and profile only.</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <FieldLabel variant="dialog">Password</FieldLabel>
                  <div className="relative">
                    <KeyRound className={ICON_CLASS} size={16} />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Leave blank to generate a secure temporary password"
                      value={formData.password}
                      onChange={(e) => update({ password: e.target.value })}
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Optional. A generated password is shown once after saving; the user must change it at first sign-in.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Mobile Number</FieldLabel>
                  <div className="relative">
                    <Phone className={ICON_CLASS} size={16} />
                    <Input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder={enterPlaceholder('Mobile Number')}
                      value={formData.mobile}
                      onChange={(e) => update({ mobile: digitsOnly(e.target.value, 10) })}
                      className={ICON_INPUT_CLASS}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Branch</FieldLabel>
                  <div className="relative">
                    <Building2 className={cn(ICON_CLASS, 'z-10')} size={16} />
                    <Select
                      modal={false}
                      open={branchSelectOpen}
                      onOpenChange={setBranchSelectOpen}
                      value={formData.branchId}
                      onValueChange={(value) => update({ branchId: String(value ?? '') })}
                    >
                      <SelectTrigger className={cn('w-full pl-12', dataTableFilterControlClass)}>
                        <SelectValue placeholder={selectPlaceholder('Branch')}>
                          {branchName || undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.branch_name} ({branch.branch_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog">Address</FieldLabel>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-slate-450" size={16} />
                  <textarea
                    rows={3}
                    maxLength={1000}
                    placeholder={enterPlaceholder('Address')}
                    value={formData.address}
                    onChange={(e) => update({ address: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-deep/10 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {canAssignRoles ? (
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Role</FieldLabel>
                  <div className="relative">
                    <Briefcase className={cn(ICON_CLASS, 'z-10')} size={16} />
                    <Select
                      modal={false}
                      open={roleSelectOpen}
                      onOpenChange={setRoleSelectOpen}
                      value={formData.role}
                      onValueChange={(value) => update({ role: String(value ?? '') })}
                    >
                      <SelectTrigger className={cn('w-full pl-12', dataTableFilterControlClass)}>
                        <SelectValue placeholder={selectPlaceholder('Role')}>
                          {roleName || undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false} positionerClassName="z-[200]">
                        {assignableRoles.map((role) => (
                          <SelectItem key={role.slug} value={role.slug}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    The approval attachment from the next step is recorded as the role&apos;s approval evidence.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] text-slate-500 font-semibold">
                  Only Super Admin and Admin can assign roles. A role can be assigned from the user&apos;s profile after creation.
                </div>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Approval Attachment</FieldLabel>
                <div className="relative">
                  <Paperclip className={ICON_CLASS} size={16} />
                  <Input
                    type="file"
                    accept={APPROVAL_ATTACHMENT_ACCEPT}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setAttachment(file);
                      setError(file ? validateApprovalAttachment(file) ?? '' : '');
                    }}
                    className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-primary-deep file:text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  Approval mail or document: PDF, EML, MSG, PNG or JPG, up to 5 MB.
                </p>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog" required>Request Remarks</FieldLabel>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={formData.requestRemarks}
                  onChange={(e) => {
                    setRemarksEdited(true);
                    update({ requestRemarks: e.target.value });
                  }}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-deep/10 resize-none"
                />
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-700 font-semibold">
                The user is created inactive. Another approver must review this request before the user can sign in.
              </div>
            </div>
          )}

          </div>

          <DialogFooter className="shrink-0 p-8 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-between gap-2">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="h-12 rounded-xl text-xs font-bold text-slate-500 border-slate-200 hover:bg-slate-100 gap-2 px-5"
                >
                  <ChevronLeft size={16} />
                  Back
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                data-dialog-dismiss="true"
                onClick={closeDialog}
                className="h-12 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100 px-4"
              >
                Cancel
              </Button>

              {currentStep < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="h-12 bg-primary-deep text-white rounded-xl font-bold shadow-lg shadow-primary-deep/20 hover:opacity-95 text-xs gap-2 px-6"
                >
                  Continue
                  <ChevronRight size={16} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 bg-primary-deep text-white rounded-xl font-bold shadow-lg shadow-primary-deep/20 hover:opacity-95 text-xs px-6"
                >
                  {isLoading ? 'Submitting…' : 'Submit for Approval'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
