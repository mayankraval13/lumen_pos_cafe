import React, { useState } from 'react';
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey, useListCategories } from '@workspace/api-client-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '../../components/ui/switch';
import { apiFetch } from '../../lib/apiFetch';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../components/ui/form';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0, 'Price must be positive'),
  unit: z.string().default('Unit'),
  tax: z.coerce.number().min(0, 'Tax must be positive').default(0),
  description: z.string().optional().nullable(),
  imageUrl: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
});

export default function Products() {
  const queryClient = useQueryClient();
  const { data: productsData, isLoading } = useListProducts();
  const products = productsData?.products || [];
  const { data: categories = [] } = useListCategories();
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      price: 0,
      unit: 'Unit',
      tax: 0,
      description: '',
      imageUrl: '',
    },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    form.reset({ name: '', categoryId: '', price: 0, unit: 'Unit', tax: 0, description: '', imageUrl: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setEditingId(product.id);
    form.reset({ 
      name: product.name, 
      categoryId: product.categoryId, 
      price: product.price,
      unit: product.unit || 'Unit',
      tax: product.tax || 0,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
    });
    setIsModalOpen(true);
  };

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    const cleanValues = { ...values, imageUrl: values.imageUrl || null };
    if (editingId) {
      updateProduct.mutate(
        { id: editingId, data: cleanValues },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast.success('Product updated');
            setIsModalOpen(false);
          },
          onError: (error: any) => toast.error(error.message || 'Failed to update product'),
        }
      );
    } else {
      createProduct.mutate(
        { data: cleanValues },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast.success('Product created');
            setIsModalOpen(false);
          },
          onError: (error: any) => toast.error(error.message || 'Failed to create product'),
        }
      );
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      deleteProduct.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            toast.success('Product deleted');
          },
          onError: (error: any) => toast.error(error.message || 'Failed to delete product'),
        }
      );
    }
  };

  const availabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      apiFetch(`/api/products/${id}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    },
    onError: () => toast.error('Failed to update availability'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Products</h2>
          <p className="text-muted-foreground">Manage your product catalog.</p>
        </div>
        <Button onClick={handleOpenNew} data-testid="button-new-product">
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Tax %</TableHead>
                <TableHead>Available</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading products...</TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No products found.</TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const isAvailable = (product as any).isAvailable !== false;
                  const imageUrl = (product as any).imageUrl;
                  return (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`} className={!isAvailable ? 'opacity-60' : ''}>
                    <TableCell>
                      {imageUrl ? (
                        <img src={imageUrl} alt={product.name} className="w-10 h-10 object-cover rounded-lg border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {!isAvailable && (
                          <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/30">Unavailable</Badge>
                        )}
                        {product.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.category && (
                         <Badge style={{ backgroundColor: product.category.color, color: '#fff' }} variant="outline" className="border-transparent">
                           {product.category.name}
                         </Badge>
                      )}
                    </TableCell>
                    <TableCell>₹{product.price.toFixed(2)}</TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>{product.tax}%</TableCell>
                    <TableCell>
                      <Switch
                        checked={isAvailable}
                        onCheckedChange={(checked) =>
                          availabilityMutation.mutate({ id: product.id, isAvailable: checked })
                        }
                        disabled={availabilityMutation.isPending}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(product)} data-testid={`btn-edit-product-${product.id}`}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} data-testid={`btn-delete-product-${product.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Product' : 'Create Product'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Espresso" {...field} data-testid="input-product-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-product-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-product-price" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} data-testid="input-product-tax" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cup, Plate" {...field} data-testid="input-product-unit" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} value={field.value || ''} data-testid="input-product-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" {...field} value={field.value || ''} />
                    </FormControl>
                    {field.value && (
                      <div className="mt-1">
                        <img src={field.value} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-slate-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} data-testid="btn-save-product">
                  {editingId ? 'Save Changes' : 'Create Product'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
