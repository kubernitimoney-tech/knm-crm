import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { handleDialogOpenChange } from '@/lib/dialogCloseUtils';
import { ChangePasswordForm } from './ChangePasswordForm';

interface ChangePasswordDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordDialog = ({ isOpen, onOpenChange }: ChangePasswordDialogProps) => {
  const [succeeded, setSucceeded] = useState(false);
  // Remount the form on every open so typed passwords never linger.
  const [formKey, setFormKey] = useState(0);

  const dismissDialog = () => {
    setSucceeded(false);
    setFormKey((key) => key + 1);
  };

  const closeDialog = () => {
    dismissDialog();
    onOpenChange(false);
  };

  const handleSuccess = () => {
    setSucceeded(true);
    setTimeout(closeDialog, 2000);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open, eventDetails) => {
        handleDialogOpenChange(open, eventDetails, {
          onOpenChange,
          onDismiss: dismissDialog,
        });
      }}
    >
      <DialogContent className="sm:max-w-[440px] bg-white border-slate-200 rounded-[32px] shadow-2xl p-0 overflow-hidden font-sans">
        <DialogHeader className="p-8 pb-4">
          <div className="w-12 h-12 bg-primary-deep/5 rounded-2xl flex items-center justify-center text-primary-deep mb-4 shadow-inner">
            <ShieldCheck size={24} />
          </div>
          <DialogTitle className="text-2xl font-black text-primary-deep tracking-tight">Security Update</DialogTitle>
          <DialogDescription className="text-slate-500 font-medium text-sm">
            Update your account password to maintain security standards.
          </DialogDescription>
        </DialogHeader>

        {succeeded ? (
          <div className="p-12 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-xl font-bold text-emerald-600">Password Updated!</h3>
            <p className="text-slate-500 text-sm font-medium">Your credentials have been updated successfully.</p>
          </div>
        ) : (
          <ChangePasswordForm
            key={formKey}
            onSuccess={handleSuccess}
            secondaryAction={
              <Button
                type="button"
                variant="outline"
                data-dialog-dismiss="true"
                onClick={closeDialog}
                className="flex-1 h-12 rounded-xl text-xs font-bold text-slate-500 border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </Button>
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
