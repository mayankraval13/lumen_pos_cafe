import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Trash2, Pencil, UserCheck, Loader2, Shield,
  Store, Eye, EyeOff, UserX, Users, Grid3X3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { apiFetch } from '@/lib/apiFetch';

interface TableRow {
  id: string;
  tableNumber: string;
  seats: number;
}
interface Floor {
  id: string;
  name: string;
  tables: TableRow[];
}
interface PosConfig {
  id: string;
  name: string;
  floors: Floor[];
}
interface AssignedTable {
  id: string;
  tableNumber: string;
  floorName: string;
  posConfigName: string | null;
}
interface Waiter {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  assignedTableIds: string[];
  assignedTables: AssignedTable[];
  allocatedPosConfigs: { id: string; name: string }[];
}

const waiterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
const editWaiterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

type WaiterForm = z.infer<typeof waiterSchema>;
type EditWaiterForm = z.infer<typeof editWaiterSchema>;

export default function Waiters() {
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedWaiter, setSelectedWaiter] = useState<Waiter | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [selectedPosIds, setSelectedPosIds] = useState<string[]>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);

  const { data: waiters = [], isLoading } = useQuery<Waiter[]>({
    queryKey: ['waiters'],
    queryFn: () => apiFetch('/api/waiters'),
  });

  const { data: posConfigs = [] } = useQuery<PosConfig[]>({
    queryKey: ['pos-configs-full'],
    queryFn: () => apiFetch('/api/pos-config'),
  });

  const addForm = useForm<WaiterForm>({
    resolver: zodResolver(waiterSchema),
    defaultValues: { name: '', email: '', password: '' },
  });
  const editForm = useForm<EditWaiterForm>({
    resolver: zodResolver(editWaiterSchema),
    defaultValues: { name: '', email: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: WaiterForm) => apiFetch<Waiter>('/api/waiters', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      setAddOpen(false);
      addForm.reset();
      toast.success('Waiter added successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditWaiterForm }) =>
      apiFetch<Waiter>(`/api/waiters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      setEditOpen(false);
      toast.success('Waiter updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/waiters/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      setDeleteId(null);
      toast.success('Waiter removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, posConfigIds, tableIds }: { id: string; posConfigIds: string[]; tableIds: string[] }) => {
      await Promise.all([
        apiFetch(`/api/waiters/${id}/allocations`, { method: 'PUT', body: JSON.stringify({ posConfigIds }) }),
        apiFetch(`/api/waiters/${id}/tables`, { method: 'PUT', body: JSON.stringify({ tableIds }) }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiters'] });
      setAllocateOpen(false);
      toast.success('Assignment saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleOpenEdit = (waiter: Waiter) => {
    setSelectedWaiter(waiter);
    editForm.reset({ name: waiter.name, email: waiter.email });
    setEditOpen(true);
  };

  const handleOpenAllocate = (waiter: Waiter) => {
    setSelectedWaiter(waiter);
    setSelectedPosIds(waiter.allocatedPosConfigs.map((p) => p.id));
    setSelectedTableIds([...waiter.assignedTableIds]);
    setAllocateOpen(true);
  };

  const togglePosId = (id: string) => {
    setSelectedPosIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleTableId = (tableId: string, posId: string) => {
    setSelectedTableIds((prev) => {
      if (prev.includes(tableId)) return prev.filter((x) => x !== tableId);
      if (!selectedPosIds.includes(posId)) setSelectedPosIds((p) => [...p, posId]);
      return [...prev, tableId];
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm mt-1">
            Add waiters, assign restaurants and specific tables to each waiter.
          </p>
        </div>
        <Button onClick={() => { addForm.reset(); setShowPassword(false); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Waiter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : waiters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No waiters yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">Add your first waiter to get started.</p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Waiter
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {waiters.map((waiter) => (
            <div key={waiter.id} className="bg-card border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">{waiter.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{waiter.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />Waiter
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{waiter.email}</p>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {waiter.assignedTables.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">No tables assigned</span>
                    ) : (
                      waiter.assignedTables.map((t) => (
                        <Badge key={t.id} variant="outline" className="text-xs">
                          <Grid3X3 className="w-3 h-3 mr-1" />
                          Table {t.tableNumber}
                          <span className="text-muted-foreground ml-1">· {t.posConfigName}</span>
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={() => handleOpenAllocate(waiter)}>
                  <UserCheck className="w-4 h-4 mr-1" />Assign
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(waiter)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(waiter.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Waiter */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Waiter</DialogTitle></DialogHeader>
          <form onSubmit={addForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="John Doe" {...addForm.register('name')} />
              {addForm.formState.errors.name && <p className="text-destructive text-xs">{addForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" placeholder="john@cafe.com" {...addForm.register('email')} />
              {addForm.formState.errors.email && <p className="text-destructive text-xs">{addForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} placeholder="Set a login password" {...addForm.register('password')} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {addForm.formState.errors.password && <p className="text-destructive text-xs">{addForm.formState.errors.password.message}</p>}
              <p className="text-xs text-muted-foreground">Share this with the waiter so they can log in.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Waiter
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Waiter */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Waiter</DialogTitle></DialogHeader>
          <form onSubmit={editForm.handleSubmit((d) => selectedWaiter && editMutation.mutate({ id: selectedWaiter.id, data: d }))} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input {...editForm.register('name')} />
              {editForm.formState.errors.name && <p className="text-destructive text-xs">{editForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" {...editForm.register('email')} />
              {editForm.formState.errors.email && <p className="text-destructive text-xs">{editForm.formState.errors.email.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Tables & Restaurants */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Tables — {selectedWaiter?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
            {posConfigs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No restaurants configured yet.</p>
            ) : posConfigs.map((pos) => (
              <div key={pos.id} className="border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 px-4 py-3 bg-muted/40 cursor-pointer hover:bg-muted/70 transition-colors">
                  <Checkbox checked={selectedPosIds.includes(pos.id)} onCheckedChange={() => togglePosId(pos.id)} />
                  <Store className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{pos.name}</span>
                </label>
                {pos.floors.map((floor) => (
                  <div key={floor.id} className="px-4 py-2 border-t">
                    <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">{floor.name}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {floor.tables.length === 0 ? (
                        <p className="col-span-4 text-xs text-muted-foreground italic">No tables on this floor</p>
                      ) : floor.tables.map((table) => (
                        <label
                          key={table.id}
                          className={`flex flex-col items-center gap-1 p-2 border rounded-lg cursor-pointer text-center transition-colors ${
                            selectedTableIds.includes(table.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-muted hover:border-primary/50'
                          }`}
                          onClick={() => toggleTableId(table.id, pos.id)}
                        >
                          <Checkbox
                            checked={selectedTableIds.includes(table.id)}
                            onCheckedChange={() => toggleTableId(table.id, pos.id)}
                            className="pointer-events-none"
                          />
                          <span className="text-xs font-bold">{table.tableNumber}</span>
                          <span className="text-[10px] text-muted-foreground">{table.seats} seats</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Selecting a table auto-adds the restaurant. If no tables are selected, the waiter can access all tables in the assigned restaurant.
            </p>
          </div>
          <DialogFooter className="border-t pt-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {selectedTableIds.length > 0 ? `${selectedTableIds.length} table(s) selected` : 'No tables selected'}
            </div>
            <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => selectedWaiter && saveMutation.mutate({ id: selectedWaiter.id, posConfigIds: selectedPosIds, tableIds: selectedTableIds })}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Waiter</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the waiter and revoke their access.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              <UserX className="w-4 h-4 mr-2" />Remove Waiter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
