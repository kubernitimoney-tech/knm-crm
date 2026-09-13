import type { PermissionBinding } from '@/lib/resolvePermissionBinding';

export type UiCrudAction = 'view' | 'create' | 'update' | 'delete';

export type UiSectionManifest = Partial<Record<UiCrudAction | string, PermissionBinding>>;

/**
 * Maps UI surfaces to permission codes. Grant a code in the permission matrix → button appears.
 * Backend must enforce the same codes (see application_service, lead_detail_actions, etc.).
 */
export const PERMISSION_UI_MANIFEST = {
  leadDetails: {
    sanction: {
      create: ['application.approve', 'application.sanction', 'application.reject'],
      update: 'application.update',
      editPricing: 'application.update',
    },
    disbursal: {
      send: 'disbursal.send',
      create: 'disbursal.create',
      update: ['disbursal.send', 'disbursal.update'],
    },
    collection: {
      create: 'collection.create',
      update: 'collection.update',
      delete: 'collection.delete',
    },
    remark: {
      create: ['collection.create', 'collection.update', 'call_log.create'],
      update: ['collection.create', 'collection.update', 'call_log.create'],
      delete: ['collection.delete', 'collection.create', 'call_log.create'],
    },
    document: {
      view: 'document.view',
      upload: 'document.upload',
      reupload: 'document.reupload',
      download: 'document.download',
      delete: 'document.delete',
    },
    address: {
      create: 'address.create',
      update: 'address.update',
      delete: 'address.delete',
    },
    company: {
      create: 'company.create',
      update: 'company.update',
      delete: 'company.delete',
    },
    reference: {
      create: 'reference.create',
      update: 'reference.update',
      delete: 'reference.delete',
    },
    customer: {
      view: 'customer.view',
      update: 'customer.update',
    },
    statusHistory: {
      view: 'workflow.view',
    },
  },
  users: {
    user: {
      view: 'user.view',
      create: 'user.create',
      update: 'user.update',
      delete: 'user.delete',
    },
  },
  activityLogs: {
    log: {
      view: 'audit.view',
      delete: 'audit.delete',
    },
  },
  listings: {
    lead: {
      view: 'lead.view',
      update: 'lead.update',
      delete: 'lead.delete',
      assign: 'lead.assign',
      export: 'lead.export',
      create: 'lead.create',
    },
  },
} as const satisfies Record<string, Record<string, UiSectionManifest>>;

export type PermissionUiPage = keyof typeof PERMISSION_UI_MANIFEST;
