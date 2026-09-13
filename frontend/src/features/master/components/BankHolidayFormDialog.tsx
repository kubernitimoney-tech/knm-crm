import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/field-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import {
  buildBankHolidayFinancialYearOptions,
  defaultBankHolidayFinancialYearStart,
  financialYearEndDate,
  financialYearStartDate,
  formatFinancialYearLabel,
  formatFinancialYearRangeLabel,
  isoDateInFinancialYear,
} from '@/lib/financialYear';
import {
  createBankHoliday,
  updateBankHoliday,
  type BankHoliday,
} from '@/lib/bankHolidaysApi';
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { cn } from '@/lib/utils';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { enterPlaceholder, selectPlaceholder } from '@/lib/placeholders';

export interface BankHolidayFormValues {
  financialYearStart: number;
  holidayDate: string;
  holidayName: string;
}

interface BankHolidayFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingHoliday: BankHoliday | null;
  onSaved: () => void;
}

const emptyForm = (): BankHolidayFormValues => ({
  financialYearStart: defaultBankHolidayFinancialYearStart(),
  holidayDate: '',
  holidayName: '',
});

export function BankHolidayFormDialog({
  open,
  onOpenChange,
  editingHoliday,
  onSaved,
}: BankHolidayFormDialogProps) {
  const [form, setForm] = useState<BankHolidayFormValues>(emptyForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const yearOptions = useMemo(() => buildBankHolidayFinancialYearOptions(), []);
  const isEditing = Boolean(editingHoliday);

  const dateBounds = useMemo(
    () => ({
      minDate: financialYearStartDate(form.financialYearStart),
      maxDate: financialYearEndDate(form.financialYearStart),
    }),
    [form.financialYearStart],
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingHoliday) {
      setForm({
        financialYearStart: editingHoliday.financialYearStart,
        holidayDate: editingHoliday.holidayDate,
        holidayName: editingHoliday.holidayName,
      });
      return;
    }
    setForm(emptyForm());
  }, [open, editingHoliday]);

  const handleFinancialYearChange = (financialYearStart: number) => {
    setForm((prev) => {
      const holidayDate =
        prev.holidayDate && isoDateInFinancialYear(prev.holidayDate, financialYearStart)
          ? prev.holidayDate
          : '';
      return { ...prev, financialYearStart, holidayDate };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const holidayName = form.holidayName.trim();
    if (!holidayName) {
      setError('Please enter the holiday name.');
      return;
    }
    if (!form.holidayDate) {
      setError('Please select the holiday date.');
      return;
    }
    if (!isoDateInFinancialYear(form.holidayDate, form.financialYearStart)) {
      setError(`Date must fall within FY ${formatFinancialYearLabel(form.financialYearStart)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        holiday_date: form.holidayDate,
        holiday_name: holidayName,
        financial_year_start: form.financialYearStart,
      };

      if (editingHoliday) {
        await updateBankHoliday(editingHoliday.id, payload);
      } else {
        await createBankHoliday(payload);
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bank holiday.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeDialog = () => {
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        handleDialogOpenChange(nextOpen, eventDetails, {
          onOpenChange,
          onDismiss: () => setError(''),
        });
      }}
    >
      <DialogContent className="sm:max-w-[520px] rounded-3xl border-slate-200 p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-black text-primary-deep tracking-tight">
              {isEditing ? 'Edit Bank Holiday' : 'Add Bank Holiday'}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-slate-500">
              Maintain RBI bank holidays by financial year (April–March).
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4 space-y-5">
            <div className="space-y-2">
              <FieldLabel required>Financial Year</FieldLabel>
              <Select
                value={String(form.financialYearStart)}
                onValueChange={(value) => handleFinancialYearChange(Number(value))}
              >
                <SelectTrigger className={cn('w-full', dataTableFilterControlClass)}>
                  <SelectValue placeholder={selectPlaceholder('Financial Year')} />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      FY {formatFinancialYearLabel(year)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] font-medium text-slate-500">
                {formatFinancialYearRangeLabel(form.financialYearStart)}
              </p>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Holiday Date</FieldLabel>
              <DatePicker
                value={form.holidayDate}
                onChange={(holidayDate) => setForm((prev) => ({ ...prev, holidayDate }))}
                placeholder={selectPlaceholder('Holiday Date')}
                size="sm"
                minDate={dateBounds.minDate}
                maxDate={dateBounds.maxDate}
                toYear={dateBounds.maxDate.getFullYear()}
                inDialog
              />
            </div>

            <div className="space-y-2">
              <FieldLabel required>Holiday Name</FieldLabel>
              <Input
                value={form.holidayName}
                onChange={(e) => setForm((prev) => ({ ...prev, holidayName: e.target.value }))}
                placeholder={enterPlaceholder('Holiday Name')}
                className="h-11 rounded-xl border-slate-200 text-sm font-semibold"
                maxLength={255}
                required
              />
            </div>

            {error && (
              <p className="text-sm font-semibold text-rose-600 rounded-xl bg-rose-50 px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <Button
              type="button"
              variant="outline"
              data-dialog-dismiss="true"
              className="h-11 rounded-xl font-bold text-xs uppercase tracking-widest"
              onClick={closeDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-xl bg-primary-deep hover:bg-secondary-dark font-bold text-xs uppercase tracking-widest px-6"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Holiday' : 'Save Holiday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
