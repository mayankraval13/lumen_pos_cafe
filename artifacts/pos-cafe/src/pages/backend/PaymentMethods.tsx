import React from 'react';
import { useListPaymentMethods, useUpdatePaymentMethod, getListPaymentMethodsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

export default function PaymentMethods() {
  const queryClient = useQueryClient();
  const { data: methods = [], isLoading } = useListPaymentMethods();
  const updateMethod = useUpdatePaymentMethod();

  const handleToggle = (id: string, enabled: boolean) => {
    updateMethod.mutate(
      { id, data: { enabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
          toast.success('Payment method updated');
        },
        onError: (error: any) => toast.error(error.message || 'Failed to update payment method'),
      }
    );
  };

  const handleUpiUpdate = (id: string, upiId: string) => {
    updateMethod.mutate(
      { id, data: { upiId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPaymentMethodsQueryKey() });
          toast.success('UPI ID updated');
        },
        onError: (error: any) => toast.error(error.message || 'Failed to update UPI ID'),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payment Methods</h2>
        <p className="text-muted-foreground">Configure accepted payment methods for the POS.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground">Loading payment methods...</p>
        ) : (
          methods.map((method) => (
            <Card key={method.id} className="border-border shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{method.name}</CardTitle>
                  <Switch 
                    checked={method.enabled} 
                    onCheckedChange={(checked) => handleToggle(method.id, checked)} 
                    data-testid={`switch-method-${method.name}`}
                  />
                </div>
                <CardDescription>
                  {method.name === 'CASH' && 'Accept physical cash payments.'}
                  {method.name === 'DIGITAL' && 'External digital payments (Cards).'}
                  {method.name === 'UPI' && 'Accept Indian UPI payments via QR.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {method.name === 'UPI' && method.enabled && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="upi-id">Merchant UPI ID</Label>
                    <div className="flex space-x-2">
                      <Input 
                        id="upi-id"
                        defaultValue={method.upiId || ''} 
                        placeholder="merchant@upi"
                        onBlur={(e) => {
                          if (e.target.value !== method.upiId) {
                            handleUpiUpdate(method.id, e.target.value);
                          }
                        }}
                        data-testid="input-upi-id"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
