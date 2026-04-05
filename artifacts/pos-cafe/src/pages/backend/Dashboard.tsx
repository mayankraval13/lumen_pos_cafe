import React, { useState } from 'react';
import { useGetDashboard } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { apiFetch } from '../../lib/apiFetch';
import { toast } from 'sonner';

interface TodayProduct {
  productId: string;
  name: string;
  category: string;
  qty: number;
  revenue: number;
}

interface TodayReport {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrder: number;
  products: TodayProduct[];
}

function generateSalesPdf(report: TodayReport) {
  const doc = new jsPDF();
  const today = format(new Date(report.date), 'MMMM dd, yyyy');
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Sales Report', pageWidth / 2, 22, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(today, pageWidth / 2, 30, { align: 'center' });

  // Divider
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, 35, pageWidth - 14, 35);

  // Summary boxes
  doc.setTextColor(60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const summaryY = 44;
  const colW = (pageWidth - 28) / 3;

  const summaryItems = [
    { label: 'Total Revenue', value: `Rs. ${report.totalRevenue.toFixed(2)}` },
    { label: 'Total Orders', value: String(report.totalOrders) },
    { label: 'Average Order', value: `Rs. ${report.avgOrder.toFixed(2)}` },
  ];
  summaryItems.forEach((item, i) => {
    const x = 14 + i * colW;
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(x, summaryY - 6, colW - 4, 18, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x + (colW - 4) / 2, summaryY, { align: 'center' });
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x + (colW - 4) / 2, summaryY + 8, { align: 'center' });
  });

  // Products table header
  let y = summaryY + 24;
  doc.setFontSize(13);
  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales by Product', 14, y);
  y += 8;

  const cols = { num: 14, name: 24, category: 90, qty: 140, revenue: 165 };

  doc.setFillColor(30, 30, 30);
  doc.roundedRect(14, y - 5, pageWidth - 28, 9, 1, 1, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.text('#', cols.num + 2, y + 1);
  doc.text('Product', cols.name + 2, y + 1);
  doc.text('Category', cols.category, y + 1);
  doc.text('Qty', cols.qty, y + 1, { align: 'right' });
  doc.text('Revenue', pageWidth - 16, y + 1, { align: 'right' });
  y += 10;

  // Product rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40);
  doc.setFontSize(9);

  let grandQty = 0;
  let grandRevenue = 0;

  report.products.forEach((p, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4.5, pageWidth - 28, 8, 'F');
    }
    doc.setTextColor(80);
    doc.text(String(i + 1), cols.num + 2, y);
    doc.setTextColor(30);
    doc.setFont('helvetica', 'bold');
    doc.text(p.name, cols.name + 2, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(p.category, cols.category, y);
    doc.text(String(p.qty), cols.qty, y, { align: 'right' });
    doc.text(`Rs. ${p.revenue.toFixed(2)}`, pageWidth - 16, y, { align: 'right' });
    y += 8;
    grandQty += p.qty;
    grandRevenue += p.revenue;
  });

  if (report.products.length === 0) {
    doc.setTextColor(140);
    doc.text('No sales recorded today.', pageWidth / 2, y, { align: 'center' });
    y += 8;
  }

  // Grand total row
  if (report.products.length > 0) {
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.line(14, y - 3, pageWidth - 14, y - 3);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30);
    doc.setFontSize(10);
    doc.text('TOTAL', cols.name + 2, y + 2);
    doc.text(String(grandQty), cols.qty, y + 2, { align: 'right' });
    doc.text(`Rs. ${grandRevenue.toFixed(2)}`, pageWidth - 16, y + 2, { align: 'right' });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}  |  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' },
    );
  }

  doc.save(`Sales_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export default function Dashboard() {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  
  const { data, isLoading } = useGetDashboard({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const report = await apiFetch<TodayReport>('/api/reporting/today-products');
      generateSalesPdf(report);
      toast.success('PDF downloaded successfully');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const { totalOrders = 0, avgOrder = 0, totalRevenue = 0, salesByDay = [], salesByCategory = [], topProducts = [], topCategories = [], recentOrders = [] } = data || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Overview of your cafe's performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            Today's Sales PDF
          </Button>
          <Input 
            type="date" 
            value={dateFrom} 
            onChange={(e) => setDateFrom(e.target.value)} 
            className="w-auto"
            data-testid="filter-date-from"
          />
          <span className="text-muted-foreground">to</span>
          <Input 
            type="date" 
            value={dateTo} 
            onChange={(e) => setDateTo(e.target.value)} 
            className="w-auto"
            data-testid="filter-date-to"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{avgOrder.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Sales Over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM dd')} />
                <YAxis />
                <Tooltip labelFormatter={(val) => format(new Date(val), 'MMM dd, yyyy')} formatter={(val: number) => [`₹${val.toFixed(2)}`, 'Revenue']} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={salesByCategory}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {salesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => `₹${val.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product) => (
                  <TableRow key={product.productId}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">{product.qty}</TableCell>
                    <TableCell className="text-right">₹{product.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {topProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id.slice(0, 8)}...</TableCell>
                    <TableCell>{format(new Date(order.createdAt), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'PAID' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">₹{order.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {recentOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No recent orders</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
