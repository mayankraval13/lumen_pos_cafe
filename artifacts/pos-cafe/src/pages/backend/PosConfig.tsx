import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useListPosConfig,
  useCreatePosConfig,
  useDeletePosConfig,
  useOpenSession,
  getListPosConfigQueryKey,
  type PosConfig,
  type UserSummary,
} from '@workspace/api-client-react';
import { apiFetch } from '../../lib/apiFetch';
import { Plus, Trash2, MonitorSmartphone, Power, Settings2, Users, CreditCard, LayoutGrid } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { format } from 'date-fns';

const PAYMENT_TYPES = [
  { value: 'CASH', label: 'Cash', icon: '💵' },
  { value: 'DIGITAL', label: 'Card / Digital', icon: '💳' },
  { value: 'UPI', label: 'UPI', icon: '📱' },
];

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  allowedPaymentMethods: z.array(z.string()).min(1, 'Select at least one payment method'),
  allowedCashierIds: z.array(z.string()),
});

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  allowedPaymentMethods: z.array(z.string()).min(1, 'Select at least one payment method'),
  allowedCashierIds: z.array(z.string()),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

function useUsers() {
  return useQuery<UserSummary[]>({
    queryKey: ['/api/users'],
    queryFn: () => apiFetch('/api/users'),
  });
}

function useUpdatePosConfig() {
  return useMutation<PosConfig, Error, { id: string; data: Partial<EditValues> }>({
    mutationFn: ({ id, data }) =>
      apiFetch(`/api/pos-config/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  });
}

function PaymentMethodBadges({ methods }: { methods: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {methods.map((m) => {
        const pm = PAYMENT_TYPES.find((p) => p.value === m);
        return (
          <Badge key={m} variant="secondary" className="text-xs">
            {pm?.icon} {pm?.label ?? m}
          </Badge>
        );
      })}
    </div>
  );
}

function CashierBadges({ ids, users }: { ids: string[]; users: UserSummary[] }) {
  if (ids.length === 0) return <span className="text-xs text-muted-foreground">All users</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const u = users.find((us) => us.id === id);
        return (
          <Badge key={id} variant="outline" className="text-xs">
            {u?.name ?? id}
          </Badge>
        );
      })}
    </div>
  );
}

export default function PosConfig() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: posConfigs = [], isLoading } = useListPosConfig();
  const { data: users = [] } = useUsers();

  const createPosConfig = useCreatePosConfig();
  const deletePosConfig = useDeletePosConfig();
  const openSession = useOpenSession();
  const updatePosConfig = useUpdatePosConfig();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PosConfig | null>(null);

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', allowedPaymentMethods: ['CASH', 'DIGITAL', 'UPI'], allowedCashierIds: [] },
  });

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: '', allowedPaymentMethods: [], allowedCashierIds: [] },
  });

  useEffect(() => {
    if (editingConfig) {
      editForm.reset({
        name: editingConfig.name,
        allowedPaymentMethods: editingConfig.allowedPaymentMethods ?? ['CASH', 'DIGITAL', 'UPI'],
        allowedCashierIds: editingConfig.allowedCashierIds ?? [],
      });
    }
  }, [editingConfig]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPosConfigQueryKey() });

  const onCreateSubmit = (values: CreateValues) => {
    createPosConfig.mutate(
      { data: values },
      {
        onSuccess: () => {
          invalidate();
          toast.success('POS Terminal created');
          setIsCreateOpen(false);
          createForm.reset({ name: '', allowedPaymentMethods: ['CASH', 'DIGITAL', 'UPI'], allowedCashierIds: [] });
        },
        onError: (e: any) => toast.error(e.message || 'Failed to create POS Terminal'),
      }
    );
  };

  const onEditSubmit = (values: EditValues) => {
    if (!editingConfig) return;
    updatePosConfig.mutate(
      { id: editingConfig.id, data: values },
      {
        onSuccess: () => {
          invalidate();
          toast.success('Settings saved');
          setEditingConfig(null);
        },
        onError: (e: any) => toast.error(e.message || 'Failed to save settings'),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this POS terminal?')) return;
    deletePosConfig.mutate({ id }, {
      onSuccess: () => { invalidate(); toast.success('Terminal deleted'); },
      onError: (e: any) => toast.error(e.message || 'Failed to delete'),
    });
  };

  const handleOpenSession = (posConfigId: string) => {
    openSession.mutate({ data: { posConfigId } }, {
      onSuccess: () => { toast.success('Session opened'); setLocation('/pos'); },
      onError: (e: any) => toast.error(e.message || 'Failed to open session'),
    });
  };

  function CheckboxGroup({ field, options, label }: {
    field: any;
    options: { value: string; label: string; icon?: string }[];
    label: string;
  }) {
    return (
      <div className="space-y-2">
        <FormLabel>{label}</FormLabel>
        <div className="grid grid-cols-1 gap-2">
          {options.map((opt) => {
            const checked = (field.value as string[]).includes(opt.value);
            return (
              <div key={opt.value} className="flex items-center gap-2 rounded-md border p-2 hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  const current: string[] = field.value ?? [];
                  field.onChange(checked ? current.filter((v: string) => v !== opt.value) : [...current, opt.value]);
                }}
              >
                <Checkbox checked={checked} onCheckedChange={() => {
                  const current: string[] = field.value ?? [];
                  field.onChange(checked ? current.filter((v: string) => v !== opt.value) : [...current, opt.value]);
                }} />
                <span className="text-sm">{opt.icon && <span className="mr-1">{opt.icon}</span>}{opt.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const configSettingsContent = (form: any, onSubmit: any, isPending: boolean) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Terminal Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g. Main Register, Bar POS" {...field} data-testid="input-pos-name" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Separator />

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CreditCard className="w-4 h-4" />
          Payment Methods
        </div>
        <FormField control={form.control} name="allowedPaymentMethods" render={({ field }) => (
          <FormItem>
            <CheckboxGroup field={field} options={PAYMENT_TYPES} label="Accepted payment methods for this terminal" />
            <FormMessage />
          </FormItem>
        )} />

        <Separator />

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Users className="w-4 h-4" />
          Cashier Access
        </div>
        <FormField control={form.control} name="allowedCashierIds" render={({ field }) => (
          <FormItem>
            <CheckboxGroup
              field={field}
              options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role.toLowerCase()}) — ${u.email}` }))}
              label="Allowed cashiers (leave empty to allow all)"
            />
            <FormMessage />
          </FormItem>
        )} />

        <DialogFooter className="pt-2">
          <Button type="submit" disabled={isPending} data-testid="btn-save-pos">
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Manage POS terminals. Configure payment methods and cashiers per terminal.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-pos">
          <Plus className="w-4 h-4 mr-2" />
          New Terminal
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading terminals...</p>
      ) : posConfigs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MonitorSmartphone className="w-14 h-14 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No POS terminals yet. Create one to start selling.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {posConfigs.map((pos) => (
            <Card key={pos.id} data-testid={`row-pos-${pos.id}`} className="overflow-hidden">
              <div className="flex items-stretch">
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MonitorSmartphone className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-base">{pos.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Last opened: {pos.lastOpenedAt ? format(new Date(pos.lastOpenedAt), 'MMM d, yyyy HH:mm') : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingConfig(pos)} data-testid={`btn-settings-${pos.id}`}>
                        <Settings2 className="w-4 h-4 mr-1" />
                        Configure
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(pos.id)} data-testid={`btn-delete-pos-${pos.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <CreditCard className="w-3 h-3" />
                        Payment Methods
                      </div>
                      <PaymentMethodBadges methods={pos.allowedPaymentMethods ?? ['CASH', 'DIGITAL', 'UPI']} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <Users className="w-3 h-3" />
                        Cashiers
                      </div>
                      <CashierBadges ids={pos.allowedCashierIds ?? []} users={users} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                        <LayoutGrid className="w-3 h-3" />
                        Floor Plans
                      </div>
                      {(pos.floors?.length ?? 0) === 0 ? (
                        <span className="text-xs text-muted-foreground">No floors linked</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {pos.floors?.map((f) => (
                            <Badge key={f.id} variant="secondary" className="text-xs">
                              {f.name} ({f.tables?.length ?? 0} tables)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center px-5 border-l bg-muted/20 gap-2 min-w-[140px]">
                  <p className="text-xs text-muted-foreground">Last Session</p>
                  <p className="text-lg font-bold">₹{pos.lastSaleAmount.toFixed(0)}</p>
                  <Button
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleOpenSession(pos.id)}
                    disabled={openSession.isPending}
                    data-testid={`btn-open-session-${pos.id}`}
                  >
                    <Power className="w-4 h-4 mr-1" />
                    Open Session
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Terminal Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New POS Terminal</DialogTitle>
          </DialogHeader>
          {configSettingsContent(createForm, onCreateSubmit, createPosConfig.isPending)}
        </DialogContent>
      </Dialog>

      {/* Edit Settings Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={(open) => { if (!open) setEditingConfig(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Configure — {editingConfig?.name}
            </DialogTitle>
          </DialogHeader>
          {editingConfig && configSettingsContent(editForm, onEditSubmit, updatePosConfig.isPending)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
