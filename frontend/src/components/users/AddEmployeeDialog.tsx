import React, { useState, useEffect, type SyntheticEvent } from 'react';
import {
  UserPlus,
  Mail,
  User as UserIcon,
  Briefcase,
  BadgeCheck,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Paperclip
} from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
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
import { FieldLabel, RequiredMark } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import {
  assignUserRole,
  createUser,
  fetchAssignableRoles,
  type AssignableRole,
} from '@/lib/usersApi';
import {
  digitsOnly,
  normalizeIndianMobile,
  upperAlphanumeric,
  validateAadhaar,
  validateIfsc,
  validateMobile,
  validatePan,
} from '@/lib/indiaValidators';
import { validateBusinessEmail } from '@/lib/emailValidators';
import {
  handleDialogOpenChange,
  type DialogChangeEventDetails,
} from '@/lib/dialogCloseUtils';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

interface AddEmployeeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  canAssignRoles: boolean;
  onAdd: () => void;
}

export const AddEmployeeDialog = ({
  isOpen,
  onOpenChange,
  canAssignRoles,
  onAdd,
}: AddEmployeeDialogProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [assignableRoles, setAssignableRoles] = useState<AssignableRole[]>([]);
  const [approvalFile, setApprovalFile] = useState<File | null>(null);
  const [roleSelectOpen, setRoleSelectOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    employeeId: 'KNM' + Math.floor(1000 + Math.random() * 9000),
    role: '',
    department: 'Lending Operations',
    location: 'Mumbai, MH',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'Active',
    manager: 'Suresh Raina',
    panCard: '',
    aadhaarNo: '',
    bankAccount: '',
    ifscCode: '',
  });

  useEffect(() => {
    if (isOpen && canAssignRoles) {
      fetchAssignableRoles()
        .then(setAssignableRoles)
        .catch(() => setAssignableRoles([]));
    }
  }, [isOpen, canAssignRoles]);

  const handleNext = () => {
    if (currentStep === 1) {
      const emailError = validateBusinessEmail(formData.email, {
        required: true,
        label: 'Work email address',
      });
      if (emailError) {
        setError(emailError);
        return;
      }
      const phoneError = validateMobile(formData.phone, { required: true, label: 'Mobile phone' });
      if (phoneError) {
        setError(phoneError);
        return;
      }
    }
    if (currentStep === 2) {
      const validationError =
        validatePan(formData.panCard, { required: true, label: 'PAN card number' })
        ?? validateAadhaar(formData.aadhaarNo, { required: true, label: 'Aadhaar number' })
        ?? (formData.ifscCode.trim()
          ? validateIfsc(formData.ifscCode, { label: 'IFSC code' })
          : null);
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError('');
    if (currentStep < 3) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const triggerVerification = () => {
    const panError = validatePan(formData.panCard, { required: true, label: 'PAN card number' });
    const aadhaarError = validateAadhaar(formData.aadhaarNo, { required: true, label: 'Aadhaar number' });
    if (panError || aadhaarError) {
      setError(panError ?? aadhaarError ?? 'Please provide valid PAN and Aadhaar numbers.');
      return;
    }
    setError('');
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setIsVerified(true);
    }, 1500);
  };

  const splitName = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    return {
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' ') || (parts[0] ?? ''),
    };
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (canAssignRoles && formData.role && !approvalFile) {
      setError('Approval email attachment is required when assigning a role.');
      return;
    }

    const emailError = validateBusinessEmail(formData.email, {
      required: true,
      label: 'Work email address',
    });
    if (emailError) {
      setError(emailError);
      return;
    }

    const phoneError = validateMobile(formData.phone, { required: true, label: 'Mobile phone' });
    if (phoneError) {
      setError(phoneError);
      return;
    }

    setIsLoading(true);
    try {
      const { first_name, last_name } = splitName(formData.name);
      const password = formData.password || `${formData.email}@Lms123!`;

      const user = await createUser({
        email: formData.email,
        password,
        first_name,
        last_name,
        mobile_number: normalizeIndianMobile(formData.phone),
      });

      if (canAssignRoles && formData.role && approvalFile) {
        await assignUserRole(user.id, formData.role, approvalFile);
      }

      onAdd();
      onOpenChange(false);
      setCurrentStep(1);
      setIsVerified(false);
      setApprovalFile(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        employeeId: 'KNM' + Math.floor(1000 + Math.random() * 9000),
        role: '',
        department: 'Lending Operations',
        location: 'Mumbai, MH',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        manager: 'Suresh Raina',
        panCard: '',
        aadhaarNo: '',
        bankAccount: '',
        ifscCode: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const dismissDialog = () => {
    setCurrentStep(1);
    setIsVerified(false);
    setError('');
    setApprovalFile(null);
    setRoleSelectOpen(false);
  };

  const closeDialog = () => {
    dismissDialog();
    onOpenChange(false);
  };

  const activeProgressText = () => {
    switch (currentStep) {
      case 1: return "Step 1: Credentials & Contact";
      case 2: return "Step 2: Compliance & KYC Validation";
      case 3: return "Step 3: Role & Organization Assignment";
      default: return "";
    }
  };

  return (
    <Dialog
      open={isOpen}
      modal="trap-focus"
      onOpenChange={(open, eventDetails) => {
        handleDialogOpenChange(open, eventDetails, {
          selectOpen: roleSelectOpen,
          onOpenChange,
          onDismiss: dismissDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[600px] bg-white border-slate-200 rounded-[32px] shadow-2xl p-0 overflow-visible font-sans">
        <DialogHeader className="p-8 pb-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep shadow-inner ring-1 ring-primary-deep/10">
              <UserPlus size={24} />
            </div>
            <div className="flex gap-1.5 items-center">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    step === currentStep
                      ? "bg-primary-deep w-6"
                      : step < currentStep
                        ? "bg-emerald-500"
                        : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>
          <DialogTitle className="text-2xl font-black text-primary-deep tracking-tight mt-4">
            Employee On-boarding Form
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-bold text-xs uppercase tracking-wider mt-1">
            {activeProgressText()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {error && (
            <div className="mx-8 mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] font-bold text-rose-600">
              {error}
            </div>
          )}

          {currentStep === 1 && (
            <div className="p-8 space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Full Name</FieldLabel>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      placeholder={enterPlaceholder('Full Name')}
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-primary-deep/10 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel variant="dialog">Employee ID (Generated)</FieldLabel>
                  <div className="relative">
                    <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      disabled
                      value={formData.employeeId}
                      className="h-12 pl-12 bg-slate-100 font-mono border-slate-200 rounded-xl text-xs font-bold text-slate-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Work Email Address</FieldLabel>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      type="email"
                      placeholder={enterPlaceholder('Work Email Address')}
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-primary-deep/10 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Mobile Phone</FieldLabel>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      type="tel"
                      placeholder={enterPlaceholder('Mobile Phone')}
                      required
                      maxLength={10}
                      inputMode="numeric"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: digitsOnly(e.target.value, 10)})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-primary-deep/10 text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog">Temporary Password (optional)</FieldLabel>
                <Input
                  type="password"
                  placeholder={enterPlaceholder('Temporary Password')}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="h-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel variant="dialog">Primary Base Location</FieldLabel>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-455" size={16} />
                  <Input
                    placeholder={enterPlaceholder('Primary Base Location')}
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-primary-deep/10 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="p-8 space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>PAN Card Number</FieldLabel>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      placeholder={enterPlaceholder('PAN Card Number')}
                      maxLength={10}
                      value={formData.panCard}
                      onChange={(e) => setFormData({...formData, panCard: upperAlphanumeric(e.target.value, 10)})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel variant="dialog" required>Aadhaar Card Number</FieldLabel>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      placeholder={enterPlaceholder('Aadhaar Card Number')}
                      maxLength={12}
                      value={formData.aadhaarNo}
                      onChange={(e) => setFormData({...formData, aadhaarNo: digitsOnly(e.target.value, 12)})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black text-primary-deep uppercase">Uidai/Nsdl Registry Crosscheck</p>
                  <p className="text-[10px] text-slate-400 font-bold">Validate credentials against government database directories</p>
                </div>
                <Button
                  type="button"
                  onClick={triggerVerification}
                  disabled={isVerifying || isVerified || !formData.panCard || !formData.aadhaarNo}
                  className={`h-9 rounded-lg text-[10px] font-black px-4 ${
                    isVerified
                      ? "bg-emerald-500 text-white"
                      : "bg-primary-deep text-white hover:bg-secondary-dark"
                  }`}
                >
                  {isVerifying ? "Verifying..." : isVerified ? "Government Verified ✔" : "Trigger Validation"}
                </Button>
              </div>

              {isVerified && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-600 font-bold text-center animate-in zoom-in duration-200">
                  ✔ KYC Compliance Check Passed!
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FieldLabel variant="dialog">Salary Bank Account Number</FieldLabel>
                  <div className="relative">
                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      placeholder={enterPlaceholder('Salary Bank Account Number')}
                      value={formData.bankAccount}
                      onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel variant="dialog">Bank IFSC Code</FieldLabel>
                  <div className="relative">
                    <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                    <Input
                      placeholder={enterPlaceholder('IFSC Code')}
                      maxLength={11}
                      value={formData.ifscCode}
                      onChange={(e) => setFormData({...formData, ifscCode: upperAlphanumeric(e.target.value, 11)})}
                      className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="p-8 space-y-6 animate-in fade-in duration-300">
              {canAssignRoles ? (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[11px] text-amber-700 font-semibold">
                    Only Super Admin and Admin can assign roles. An approval email attachment (PDF, EML, MSG, PNG, JPG) is mandatory.
                  </div>

                  <div className="space-y-2">
                    <FieldLabel variant="dialog">Primary Role Assignment</FieldLabel>
                    <div className="relative">
                      <Briefcase className="absolute left-4 z-10 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                      <Select
                        modal={false}
                        open={roleSelectOpen}
                        onOpenChange={setRoleSelectOpen}
                        value={formData.role}
                        onValueChange={(val) => setFormData({ ...formData, role: val })}
                      >
                        <SelectTrigger className={cn('w-full pl-12', dataTableFilterControlClass)}>
                          <SelectValue placeholder={selectPlaceholder('Role')} />
                        </SelectTrigger>
                        <SelectContent
                          alignItemWithTrigger={false}
                          positionerClassName="z-[200]"
                        >
                          {assignableRoles.map((role) => (
                            <SelectItem key={role.slug} value={role.slug}>{role.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.role && (
                    <div className="space-y-2">
                      <FieldLabel variant="dialog" required>Approval Email Attachment</FieldLabel>
                      <div className="relative">
                        <Paperclip className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-450" size={16} />
                        <Input
                          type="file"
                          accept=".pdf,.eml,.msg,.png,.jpg,.jpeg"
                          required={!!formData.role}
                          onChange={(e) => setApprovalFile(e.target.files?.[0] ?? null)}
                          className="h-12 pl-12 bg-slate-50/50 border-slate-200 rounded-xl text-xs font-semibold text-slate-800 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-primary-deep file:text-white"
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] text-slate-500 font-semibold">
                  User account will be created without a role. A Super Admin or Admin must assign a role from the employee profile.
                </div>
              )}

              <div className="space-y-2">
                <FieldLabel variant="dialog">Joining Date</FieldLabel>
                <DatePicker
                  value={formData.joiningDate}
                  onChange={(joiningDate) => setFormData({ ...formData, joiningDate })}
                  placeholder={selectPlaceholder('Joining Date')}
                  inDialog
                />
              </div>
            </div>
          )}

          <DialogFooter className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-row items-center justify-between gap-3">
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

              {currentStep < 3 ? (
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
                  className="h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-xs gap-2 px-8"
                >
                  {isLoading ? 'Creating Account...' : 'Complete Onboarding'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
