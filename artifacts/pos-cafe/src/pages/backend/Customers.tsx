import React, { useState, useEffect } from 'react';
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer, getListCustomersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../../hooks/useSocket';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronUp, ShoppingBag, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/apiFetch';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().default('India'),
});

function CustomerOrders({ customerId }: { customerId: string }) {
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    apiFetch(`/api/customers/${customerId}/orders`)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) {
    return (
      <div className="px-6 py-4 text-sm text-muted-foreground animate-pulse">Loading order history…</div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="px-6 py-5 flex items-center gap-2 text-sm text-muted-foreground">
        <ShoppingBag className="w-4 h-4 opacity-40" />
        No orders recorded yet.
      </div>
    );
  }

  return (
    <div className="bg-muted/20 border-t divide-y">
      {orders.map((order: any) => {
        const total = order.lines?.reduce((s: number, l: any) => s + (l.total ?? 0), 0) ?? 0;
        return (
          <div key={order.id} className="px-6 py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
                <Badge
                  variant={order.status === 'PAID' ? 'default' : 'outline'}
                  className="text-[10px] h-4 px-1.5"
                >
                  {order.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {order.lines?.map((l: any) => `${l.qty}× ${l.productName}`).join(', ')}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap text-foreground">₹{total.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Customers() {
  const queryClient = useQueryClient();
  const { on, off } = useSocket();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: customersData, isLoading } = useListCustomers(
    search.trim() ? { search: search.trim() } : undefined,
  );
  const customers = customersData ?? [];

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
    };
    on('customer:updated', refresh);
    return () => off('customer:updated', refresh);
  }, [on, off, queryClient]);

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
    },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ name: '', email: '', phone: '', address: '', city: '', state: '', country: 'India' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: any) => {
    setEditingId(customer.id);
    form.reset({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || 'India'
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: z.infer<typeof customerSchema>) => {
    const data = { ...values, email: values.email || null };
    if (editingId) {
      updateCustomer.mutate(
        { id: editingId, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            toast.success('Customer updated');
            setIsModalOpen(false);
          },
          onError: (error: any) => toast.error(error.message || 'Failed to update customer'),
        }
      );
    } else {
      createCustomer.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            toast.success('Customer created');
            setIsModalOpen(false);
          },
          onError: (error: any) => toast.error(error.message || 'Failed to create customer'),
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
            if (expandedId === id) setExpandedId(null);
            toast.success('Customer deleted');
          },
          onError: (error: any) => toast.error(error.message || 'Failed to delete customer'),
        }
      );
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">
            Customers are auto-created when they sign in at a table via self-order QR.
          </p>
        </div>
        <Button onClick={handleOpenNew} data-testid="button-new-customer">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b bg-muted/20">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading customers...</TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <User className="w-8 h-8 opacity-20" />
                      <p>No customers yet.</p>
                      <p className="text-xs">Customers are created when guests sign in via QR self-order.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer: any) => (
                  <React.Fragment key={customer.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => toggleExpand(customer.id)}
                      data-testid={`row-customer-${customer.id}`}
                    >
                      <TableCell className="w-8 pr-0">
                        {expandedId === customer.id
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{customer.phone || '—'}</div>
                        <div className="text-xs text-muted-foreground">{customer.email || ''}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {[customer.city, customer.state].filter(Boolean).join(', ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        ₹{(customer.totalSales || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(customer)} data-testid={`btn-edit-customer-${customer.id}`}>
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)} data-testid={`btn-delete-customer-${customer.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {expandedId === customer.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={6} className="p-0">
                          <CustomerOrders customerId={customer.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Customer' : 'Create Customer'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-customer-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+91..." {...field} value={field.value || ''} data-testid="input-customer-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" type="email" {...field} value={field.value || ''} data-testid="input-customer-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" {...field} value={field.value || ''} data-testid="input-customer-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Mumbai" {...field} value={field.value || ''} data-testid="input-customer-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="Maharashtra" {...field} value={field.value || ''} data-testid="input-customer-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createCustomer.isPending || updateCustomer.isPending} data-testid="btn-save-customer">
                  {editingId ? 'Save Changes' : 'Create Customer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
