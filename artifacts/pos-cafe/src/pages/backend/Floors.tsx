import React, { useState } from 'react';
import { useListFloors, useCreateFloor, useUpdateFloor, useDeleteFloor, getListFloorsQueryKey, useListPosConfig } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Link } from 'wouter';

const floorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  posId: z.string().min(1, 'POS terminal is required'),
});

export default function Floors() {
  const queryClient = useQueryClient();
  const { data: floors = [], isLoading } = useListFloors();
  const { data: posConfigs = [] } = useListPosConfig();
  
  const createFloor = useCreateFloor();
  const updateFloor = useUpdateFloor();
  const deleteFloor = useDeleteFloor();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof floorSchema>>({
    resolver: zodResolver(floorSchema),
    defaultValues: {
      name: '',
      posId: '',
    },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ name: '', posId: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (floor: any) => {
    setEditingId(floor.id);
    form.reset({ name: floor.name, posId: floor.posId });
    setIsModalOpen(true);
  };

  const onSubmit = (values: z.infer<typeof floorSchema>) => {
    if (editingId) {
      updateFloor.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListFloorsQueryKey() });
            toast.success('Floor updated');
            setIsModalOpen(false);
          },
          onError: (error: any) => toast.error(error.message || 'Failed to update floor'),
        }
      );
    } else {
      createFloor.mutate(
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListFloorsQueryKey() });
            toast.success('Floor created');
            setIsModalOpen(false);
          },
          onError: (error: any) => toast.error(error.message || 'Failed to create floor'),
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this floor?')) {
      deleteFloor.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListFloorsQueryKey() });
            toast.success('Floor deleted');
          },
          onError: (error: any) => toast.error(error.message || 'Failed to delete floor'),
        }
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Floors & Tables</h2>
          <p className="text-muted-foreground">Manage restaurant floors and seating layout.</p>
        </div>
        <Button onClick={handleOpenNew} data-testid="button-new-floor">
          <Plus className="w-4 h-4 mr-2" />
          Add Floor
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading floors...</p>
        ) : floors.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-card border rounded-lg">
            <LayoutGrid className="mx-auto w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">No floors found. Create one to get started.</p>
          </div>
        ) : (
          floors.map((floor) => (
            <Card key={floor.id} className="border-border shadow-sm flex flex-col" data-testid={`card-floor-${floor.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span>{floor.name}</span>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(floor)}>
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(floor.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  {posConfigs.find(p => p.id === floor.posId)?.name || 'Unknown POS'}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-4">
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-muted-foreground">Tables:</span>
                  <span className="font-medium">{floor.tables?.length || 0}</span>
                </div>
                <Link href={`/backend/floors/${floor.id}`}>
                  <Button variant="secondary" className="w-full" data-testid={`btn-manage-tables-${floor.id}`}>
                    Manage Tables
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Floor' : 'Create Floor'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Floor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Main Dining, Patio" {...field} data-testid="input-floor-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="posId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned POS Terminal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-floor-pos">
                          <SelectValue placeholder="Select POS" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {posConfigs.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createFloor.isPending || updateFloor.isPending} data-testid="btn-save-floor">
                  {editingId ? 'Save Changes' : 'Create Floor'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
