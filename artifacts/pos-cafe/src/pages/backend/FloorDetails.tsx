import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { useGetFloorTables, useCreateTable, useUpdateTable, useDeleteTable, getGetFloorTablesQueryKey, useListFloors } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArrowLeft, QrCode, List, LayoutGrid, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { getTableQrUrl } from '../../lib/networkUrl';

const tableSchema = z.object({
  tableNumber: z.string().min(1, 'Table number is required'),
  seats: z.coerce.number().min(1, 'Seats must be at least 1').default(2),
  active: z.boolean().default(true),
});

export default function FloorDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: floorData } = useListFloors();
  const floor = floorData?.find(f => f.id === id);

  const { data: tables = [], isLoading } = useGetFloorTables(id || '', {
    query: { enabled: !!id }
  });

  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrModalTable, setQrModalTable] = useState<any | null>(null);

  const form = useForm<z.infer<typeof tableSchema>>({
    resolver: zodResolver(tableSchema),
    defaultValues: { tableNumber: '', seats: 2, active: true },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ tableNumber: '', seats: 2, active: true });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (table: any) => {
    setEditingId(table.id);
    form.reset({ tableNumber: table.tableNumber, seats: table.seats, active: table.active });
    setIsModalOpen(true);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetFloorTablesQueryKey(id || '') });

  const onSubmit = (values: z.infer<typeof tableSchema>) => {
    if (editingId) {
      updateTable.mutate(
        { id: editingId, data: values },
        {
          onSuccess: () => { invalidate(); toast.success('Table updated'); setIsModalOpen(false); },
          onError: (error: any) => toast.error(error.message || 'Failed to update table'),
        }
      );
    } else {
      if (!id) return;
      createTable.mutate(
        { data: { ...values, floorId: id } },
        {
          onSuccess: () => { invalidate(); toast.success('Table created'); setIsModalOpen(false); },
          onError: (error: any) => toast.error(error.message || 'Failed to create table'),
        }
      );
    }
  };

  const handleDelete = (tableId: string) => {
    if (confirm('Are you sure you want to delete this table?')) {
      deleteTable.mutate(
        { id: tableId },
        {
          onSuccess: () => { invalidate(); toast.success('Table deleted'); },
          onError: (error: any) => toast.error(error.message || 'Failed to delete table'),
        }
      );
    }
  };

  const handleToggleActive = (table: any, checked: boolean) => {
    updateTable.mutate(
      { id: table.id, data: { active: checked } },
      { onSuccess: () => invalidate() }
    );
  };

  const getQrUrl = (table: any) => getTableQrUrl(table.token || table.id);

  const downloadQR = () => {
    const svg = document.getElementById('qr-gen') as SVGElement | null;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `table-${qrModalTable?.tableNumber}-qr.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const activeTables = tables.filter(t => t.active);
  const inactiveTables = tables.filter(t => !t.active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/backend/floors">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <p className="text-muted-foreground text-sm">
            {floor?.name} · {tables.length} table{tables.length !== 1 ? 's' : ''} · {activeTables.length} active · {inactiveTables.length} inactive
          </p>
        </div>
        <div className="ml-auto flex items-center space-x-2">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button onClick={handleOpenNew} data-testid="button-new-table">
            <Plus className="w-4 h-4 mr-2" />
            Add Table
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">Loading tables...</div>
      ) : tables.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <LayoutGrid className="mx-auto w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground font-medium">No tables yet.</p>
            <p className="text-muted-foreground text-sm mt-1">Click "Add Table" to create your first table.</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        /* ── GRID / FLOOR PLAN VIEW ── */
        <div>
          {/* Legend */}
          <div className="flex items-center space-x-4 mb-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" /> Active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-200 inline-block" /> Inactive
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-4">
            {tables.map(table => (
              <div
                key={table.id}
                data-testid={`grid-table-${table.tableNumber}`}
                className={`relative flex flex-col rounded-2xl border-2 p-4 transition-all ${
                  table.active
                    ? 'border-emerald-200 bg-white hover:shadow-md hover:border-emerald-300'
                    : 'border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                {/* Status dot */}
                <span className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${
                  table.active ? 'bg-emerald-400' : 'bg-slate-300'
                }`} />

                {/* Table number */}
                <div className={`text-3xl font-extrabold leading-none mb-1 ${
                  table.active ? 'text-slate-800' : 'text-slate-400'
                }`}>
                  {table.tableNumber}
                </div>

                {/* Seats */}
                <div className="flex items-center text-xs font-medium text-slate-400 mb-3">
                  <Users className="w-3 h-3 mr-1" />
                  {table.seats} seats
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center justify-between pt-2 border-t border-slate-100">
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 rounded-full hover:bg-primary/10"
                    onClick={() => setQrModalTable(table)}
                    title="Show QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 rounded-full hover:bg-slate-100"
                    onClick={() => handleOpenEdit(table)}
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 rounded-full hover:bg-red-50"
                    onClick={() => handleDelete(table.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Add new table card */}
            <div
              onClick={handleOpenNew}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-4 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <Plus className="w-8 h-8 text-slate-300 group-hover:text-primary transition-colors mb-1" />
              <span className="text-xs text-slate-400 group-hover:text-primary font-medium transition-colors">Add Table</span>
            </div>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table No</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.id} data-testid={`row-table-${table.id}`}>
                    <TableCell className="font-medium text-lg">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${table.active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        <span>Table {table.tableNumber}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-slate-600">
                        <Users className="w-4 h-4 mr-1 text-slate-400" />
                        {table.seats}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={table.active}
                          onCheckedChange={(checked) => handleToggleActive(table, checked)}
                        />
                        <Badge variant={table.active ? 'default' : 'secondary'} className="text-xs">
                          {table.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => setQrModalTable(table)} title="QR Code">
                          <QrCode className="w-4 h-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(table)} data-testid={`btn-edit-table-${table.id}`}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(table.id)} data-testid={`btn-delete-table-${table.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── ADD / EDIT DIALOG ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Table' : 'Add Table'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tableNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 1, 2, VIP-1" {...field} data-testid="input-table-number" autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="seats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Seats</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} data-testid="input-table-seats" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <div className="text-sm text-muted-foreground">Allow ordering at this table</div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createTable.isPending || updateTable.isPending} data-testid="btn-save-table">
                  {editingId ? 'Save Changes' : 'Add Table'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── QR CODE DIALOG ── */}
      <Dialog open={!!qrModalTable} onOpenChange={(open) => !open && setQrModalTable(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Table {qrModalTable?.tableNumber} — Self-Order QR
            </DialogTitle>
          </DialogHeader>
          {qrModalTable && (
            <div className="flex flex-col items-center justify-center space-y-5 py-4">
              <div className="p-5 bg-white rounded-2xl shadow-sm border">
                <QRCodeSVG
                  id="qr-gen"
                  value={getQrUrl(qrModalTable)}
                  size={240}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-slate-700">Scan to open self-order menu</p>
                <p className="text-xs text-muted-foreground break-all px-4">{getQrUrl(qrModalTable)}</p>
              </div>
              <Button onClick={downloadQR} className="w-full" size="lg">
                Download QR Code (SVG)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
