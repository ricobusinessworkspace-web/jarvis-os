'use client';

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { uploadTransactions } from '@/actions/finance';
import { useRouter } from 'next/navigation';

export default function CSVUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'parsing' | 'uploading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  }, []);

  const processFile = (file: File) => {
    setStatus('parsing');
    setMessage('Analysiere Datei...');

    // First pass: read raw lines to find the actual header row (banks add metadata rows at the top)
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      encoding: 'ISO-8859-1',
      complete: async (rawResults) => {
        try {
          const allRows = rawResults.data as string[][];
          
          // Find the header row by looking for a row that contains date/amount keywords
          let headerRowIndex = -1;
          const dateKeywords = ['buchungstag', 'buchungsdatum', 'day of entry', 'date', 'datum'];
          const amountKeywords = ['betrag', 'amount', 'umsatz'];
          
          for (let i = 0; i < Math.min(allRows.length, 15); i++) {
            const rowLower = allRows[i].map(cell => (cell || '').toLowerCase().trim());
            const hasDate = rowLower.some(cell => dateKeywords.some(kw => cell.includes(kw)));
            const hasAmount = rowLower.some(cell => amountKeywords.some(kw => cell.includes(kw)));
            if (hasDate && hasAmount) {
              headerRowIndex = i;
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            // Fallback: show what we found for debugging
            const firstRowPreview = allRows.length > 0 ? allRows[0].slice(0, 5).join(', ') : 'leer';
            setStatus('error');
            setMessage(`Spalten nicht erkannt. Erste Zeile: "${firstRowPreview}..." – Bitte CSV-CAMT Format verwenden.`);
            return;
          }

          // Build header + data from the detected header row
          const headers = allRows[headerRowIndex].map(h => (h || '').trim());
          const dataRows = allRows.slice(headerRowIndex + 1);
          
          const formattedTransactions = [];

          for (const cells of dataRows) {
            if (cells.length < headers.length / 2) continue; // Skip incomplete rows
            
            // Build a row object from headers + cells
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
            
            const keys = headers;
            
            const dateKey = keys.find(k => {
              const lower = k.toLowerCase().trim();
              return lower === 'buchungstag' || lower === 'buchungsdatum' || lower === 'day of entry' || lower === 'date' || lower.includes('buchungstag') || lower.includes('buchungsdatum');
            });
            const amountKey = keys.find(k => {
              const lower = k.toLowerCase().trim();
              return lower === 'betrag' || lower === 'amount' || lower === 'umsatz' || lower === 'betrag (eur)';
            }) || keys.find(k => k.toLowerCase().includes('betrag') && !k.toLowerCase().includes('ursprünglich'));
            const descKey = keys.find(k => k.toLowerCase().includes('verwendungszweck') || k.toLowerCase().includes('purpose'));
            const nameKey = keys.find(k => k.toLowerCase().includes('begünstigt') || k.toLowerCase().includes('auftraggeber') || k.toLowerCase().includes('beneficiary') || k.toLowerCase().includes('payer')) 
              || keys.find(k => k.toLowerCase().trim() === 'name');

            if (!dateKey || !amountKey) continue;

            const dateVal = row[dateKey];
            if (!dateVal) continue;
            
            // Parse Date: support DD.MM.YYYY and DD.MM.YY
            const dateParts = dateVal.split('.');
            if (dateParts.length !== 3) continue;
            const year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2].length === 4 ? dateParts[2] : `20${dateParts[2].slice(-2)}`;
            const isoDate = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}T12:00:00Z`;

            // Parse Amount (handle German formatting: 1.234,56 → 1234.56)
            const amountRaw = row[amountKey];
            if (!amountRaw) continue;
            let amountStr = amountRaw.replace(/\./g, '').replace(',', '.');
            const amount = parseFloat(amountStr);
            if (isNaN(amount)) continue;

            const name = nameKey ? row[nameKey] : '';
            const desc = descKey ? row[descKey] : '';
            const fullDesc = [name, desc].filter(Boolean).join(' - ');

            // Generate deterministic ID
            const bankTransactionId = `${isoDate.split('T')[0]}_${amount}_${fullDesc.slice(0, 20)}`.replace(/[^a-zA-Z0-9_\-]/g, '');

            formattedTransactions.push({
              bankTransactionId,
              amount,
              description: fullDesc,
              date: isoDate,
            });
          }

          if (formattedTransactions.length === 0) {
            const detectedCols = headers.slice(0, 6).join(', ');
            setStatus('error');
            setMessage(`Keine gültigen Transaktionen. Erkannte Spalten: "${detectedCols}..." (${dataRows.length} Zeilen geparst)`);
            return;
          }

          setStatus('uploading');
          setMessage(`${formattedTransactions.length} Transaktionen werden hochgeladen...`);

          const res = await uploadTransactions(formattedTransactions);

          if (res.success) {
            setStatus('success');
            setMessage(`Erfolgreich! ${res.created} neu, ${res.skipped} übersprungen (Duplikate).`);
            router.refresh(); // Reload page to show new data
            setTimeout(() => { setStatus('idle'); setMessage(''); }, 5000);
          } else {
            setStatus('error');
            setMessage(`Fehler beim Upload: ${res.error}`);
          }

        } catch (error: any) {
          setStatus('error');
          setMessage(`Fehler beim Verarbeiten: ${error.message}`);
        }
      },
      error: (error) => {
        setStatus('error');
        setMessage(`PapaParse Fehler: ${error.message}`);
      }
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        processFile(file);
      } else {
        setStatus('error');
        setMessage('Bitte nur CSV-Dateien hochladen.');
      }
    }
  }, []);

  return (
    <div 
      className={`glass rounded-2xl border-2 border-dashed transition-all p-8 flex flex-col items-center justify-center text-center ${
        isDragging ? 'border-accent bg-accent/5 scale-[1.02]' : 'border-border hover:border-accent/50'
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {status === 'idle' && (
        <>
          <div className="p-4 rounded-full bg-accent/10 text-accent mb-4">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Bank-CSV hier ablegen</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Unterstützt DKB und BW-Bank. Duplikate werden automatisch ignoriert. Auto-Kategorisierung ist aktiv.
          </p>
          <label className="mt-6 px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent font-semibold rounded-full cursor-pointer transition-colors">
            Datei auswählen
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} 
            />
          </label>
        </>
      )}

      {(status === 'parsing' || status === 'uploading') && (
        <div className="flex flex-col items-center animate-pulse">
          <Loader2 className="h-10 w-10 text-accent animate-spin mb-4" />
          <h3 className="text-lg font-bold text-foreground">{status === 'parsing' ? 'Verarbeite CSV...' : 'Speichere Daten...'}</h3>
          <p className="text-sm text-muted-foreground mt-2">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center text-emerald-500 animate-in zoom-in">
          <CheckCircle2 className="h-12 w-12 mb-4" />
          <h3 className="text-lg font-bold">Import abgeschlossen</h3>
          <p className="text-sm mt-2">{message}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center text-red-500 animate-in shake">
          <AlertCircle className="h-12 w-12 mb-4" />
          <h3 className="text-lg font-bold">Import fehlgeschlagen</h3>
          <p className="text-sm mt-2 max-w-md">{message}</p>
          <button 
            onClick={() => { setStatus('idle'); setMessage(''); }}
            className="mt-6 px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold rounded-full transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
}
