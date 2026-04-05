import React, { useState, useMemo } from 'react';
import { useListFloors, useListPosConfig } from '@workspace/api-client-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { Download, RefreshCw, QrCode, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { apiFetch } from '../../lib/apiFetch';
import { getTableQrUrl } from '../../lib/networkUrl';

interface TableWithFloor {
  id: string;
  tableNumber: string;
  token: string;
  seats: number;
  active: boolean;
  floorId: string;
  floorName: string;
}

export default function QRCodes() {
  const { data: floors = [], isLoading, refetch } = useListFloors();
  const { data: posConfigs = [] } = useListPosConfig();

  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const restaurantName = (posConfigs as any[])[0]?.name || 'POS Cafe';

  const getUrl = (token: string) => getTableQrUrl(token);

  const networkBase = useMemo(() => {
    const sample = getTableQrUrl('__SAMPLE__');
    return sample.replace('/table/__SAMPLE__', '');
  }, []);

  const isLocalhost =
    networkBase.includes('localhost') || networkBase.includes('127.0.0.1');

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(getUrl(token));
    toast.success('URL copied to clipboard');
  };

  const rotateToken = async (tableId: string) => {
    setRotatingId(tableId);
    try {
      await apiFetch(`/api/tables/${tableId}/rotate-token`, { method: 'POST' });
      refetch();
      toast.success('Token rotated — QR code updated');
    } catch {
      toast.error('Failed to rotate token');
    } finally {
      setRotatingId(null);
    }
  };

  const allTables: TableWithFloor[] = (floors as any[]).flatMap((floor) =>
    (floor.tables ?? []).map((t: any) => ({
      ...t,
      floorName: floor.name,
    }))
  );

  const downloadPDF = async () => {
    if (allTables.length === 0) {
      toast.error('No tables to generate QR codes for');
      return;
    }
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const headerH = 22;
      const startY = headerH + 4;
      const cols = 3;
      const cellW = (pageW - margin * 2) / cols;
      const cellH = 82;
      const qrSize = 44;
      const rowsPerPage = Math.floor((pageH - startY - margin) / cellH);
      const tablesPerPage = cols * rowsPerPage;

      const drawHeader = (pageNum: number, total: number) => {
        doc.setFillColor(249, 115, 22);
        doc.rect(0, 0, pageW, headerH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(`${restaurantName}  —  Table QR Codes`, margin, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const dateStr = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        doc.text(`${dateStr}   •   Page ${pageNum}`, pageW - margin, 14, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      };

      drawHeader(1, Math.ceil(allTables.length / tablesPerPage));

      for (let i = 0; i < allTables.length; i++) {
        const localIdx = i % tablesPerPage;
        const pageIdx = Math.floor(i / tablesPerPage);

        if (i > 0 && localIdx === 0) {
          doc.addPage();
          drawHeader(pageIdx + 1, Math.ceil(allTables.length / tablesPerPage));
        }

        const col = localIdx % cols;
        const row = Math.floor(localIdx / cols);

        const t = allTables[i];
        const url = getUrl(t.token);
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });

        const x = margin + col * cellW;
        const y = startY + row * cellH;

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.25);
        doc.roundedRect(x + 1, y + 1, cellW - 2, cellH - 2, 3, 3, 'S');

        const qrX = x + (cellW - qrSize) / 2;
        doc.addImage(qrDataUrl, 'PNG', qrX, y + 4, qrSize, qrSize);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(120, 120, 120);
        doc.text(t.floorName, x + cellW / 2, y + qrSize + 10, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(20, 20, 20);
        doc.text(`Table ${t.tableNumber}`, x + cellW / 2, y + qrSize + 17, { align: 'center' });

        const maxUrlLen = 44;
        const displayUrl = url.length > maxUrlLen ? url.slice(0, maxUrlLen - 1) + '…' : url;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.2);
        doc.setTextColor(60, 60, 60);
        doc.text(displayUrl, x + cellW / 2, y + qrSize + 23.5, { align: 'center' });

        doc.setFontSize(4.8);
        doc.setTextColor(170, 170, 170);
        doc.text(`ID: ${t.token}`, x + cellW / 2, y + qrSize + 29, { align: 'center' });
      }

      doc.save(`${restaurantName.replace(/\s+/g, '_')}_QR_Codes.pdf`);
      toast.success('PDF downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading tables…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {allTables.length} table{allTables.length !== 1 ? 's' : ''} across {(floors as any[]).length} floor{(floors as any[]).length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={downloadPDF}
          disabled={generating || allTables.length === 0}
          className="gap-2 bg-primary text-white hover:bg-primary/90"
        >
          <Download className="w-4 h-4" />
          {generating ? 'Generating PDF…' : 'Download PDF'}
        </Button>
      </div>

      {isLocalhost && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Tip:</strong> You're viewing this page via <code className="bg-amber-100 px-1 rounded">localhost</code>.
          QR codes point to your LAN IP so phones on the same Wi-Fi can scan them.
          If scanning still fails, open this page using your PC's network IP (e.g.{' '}
          <code className="bg-amber-100 px-1 rounded">http://192.168.x.x:{window.location.port}</code>)
          and make sure your phone and PC are on the <strong>same Wi-Fi network</strong>.
        </div>
      )}

      {(floors as any[]).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground gap-3">
          <QrCode className="w-12 h-12 opacity-20" />
          <p className="font-medium">No floors or tables configured yet.</p>
          <p className="text-sm">Go to Floors to add your restaurant layout first.</p>
        </div>
      ) : (
        (floors as any[]).map((floor) => (
          <div key={floor.id} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-foreground">{floor.name}</h2>
              <Badge variant="outline" className="text-xs">
                {(floor.tables ?? []).length} table{(floor.tables ?? []).length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {(floor.tables ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground pl-2">No tables on this floor.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {(floor.tables as any[]).map((table: any) => {
                  const url = getUrl(table.token);
                  return (
                    <div
                      key={table.id}
                      className="bg-card border rounded-xl p-4 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="w-full flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">
                          Table {table.tableNumber}
                        </span>
                        <Badge
                          variant={table.active ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {table.active ? 'Active' : 'Off'}
                        </Badge>
                      </div>

                      <div className="p-2 bg-white rounded-lg border shadow-inner">
                        <QRCodeSVG
                          value={url}
                          size={120}
                          level="M"
                          includeMargin={false}
                        />
                      </div>

                      <div className="w-full space-y-1 text-center">
                        <p className="text-xs text-muted-foreground truncate" title={url}>
                          {url.replace(/^https?:\/\//, '')}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono truncate" title={table.token}>
                          {table.token}
                        </p>
                      </div>

                      <div className="w-full flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1 text-xs h-7"
                          onClick={() => copyUrl(table.token)}
                        >
                          <Copy className="w-3 h-3" />
                          Copy URL
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Open self-order page"
                          onClick={() => window.open(url, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Rotate token (invalidates current QR)"
                          disabled={rotatingId === table.id}
                          onClick={() => rotateToken(table.id)}
                        >
                          <RefreshCw
                            className={`w-3 h-3 ${rotatingId === table.id ? 'animate-spin' : ''}`}
                          />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
