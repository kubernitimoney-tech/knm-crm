/* eslint-disable react-refresh/only-export-components */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { dataTableFilterControlClass } from '@/components/ui/data-table';
import { cn } from '@/lib/utils';

/** Same trigger styling as All Leads filter dropdowns. */
export const appSelectTriggerClass = dataTableFilterControlClass;

export type AppSelectOption =
  | string
  | {
      value: string;
      label: string;
    };

function normalizeOptions(options: readonly AppSelectOption[]) {
  return options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
}

export interface AppSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  options: readonly AppSelectOption[];
  triggerClassName?: string;
  contentClassName?: string;
  disabled?: boolean;
  /** When false, empty value shows the placeholder until an option is picked. */
  hidePlaceholder?: boolean;
  /** Raise the menu above dialogs (z-index 200). */
  elevated?: boolean;
}

export function AppSelect({
  value,
  onValueChange,
  placeholder,
  options,
  triggerClassName,
  contentClassName,
  disabled,
  hidePlaceholder: _hidePlaceholder = false,
  elevated = false,
}: AppSelectProps) {
  const normalizedOptions = normalizeOptions(options);
  const selectValue = value || undefined;
  const selectedLabel = normalizedOptions.find((option) => option.value === value)?.label ?? '';

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => onValueChange(next ?? '')}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(appSelectTriggerClass, 'w-full', triggerClassName)}
        disabled={disabled}
      >
        <SelectValue placeholder={placeholder}>{selectedLabel || null}</SelectValue>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        positionerClassName={elevated ? 'z-[200]' : undefined}
        className={contentClassName}
      >
        {normalizedOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
