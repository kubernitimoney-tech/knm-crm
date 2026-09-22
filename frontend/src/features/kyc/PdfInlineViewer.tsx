import { useEffect, useRef, useState } from 'react';

interface PdfInlineViewerProps {
  src: string;
  title: string;
}

export function PdfInlineViewer({ src, title }: PdfInlineViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return undefined;

    let cancelled = false;
    let pdfDoc: { destroy?: () => Promise<void> } | null = null;

    const render = async () => {
      setStatus('loading');
      host.replaceChildren();
      const pdfjs = await import('pdfjs-dist');
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      const task = pdfjs.getDocument({ url: src, withCredentials: false });
      const pdf = await task.promise;
      pdfDoc = pdf;
      if (cancelled) {
        await pdf.destroy();
        return;
      }

      const width = Math.max(host.clientWidth || host.parentElement?.clientWidth || 320, 280);
      for (let number = 1; number <= pdf.numPages; number += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'public-pdf-page';
        canvas.setAttribute('aria-label', `${title} page ${number}`);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        if (!cancelled) host.appendChild(canvas);
      }
      if (!cancelled) setStatus('ready');
    };

    render().catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      void pdfDoc?.destroy?.();
    };
  }, [src, title]);

  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      {status === 'loading' ? (
        <p className="px-4 py-16 text-center text-sm text-[#424665]">Loading agreement…</p>
      ) : null}
      {status === 'error' ? (
        <p className="px-4 py-16 text-center text-sm text-red-600">
          Could not display the agreement on this screen. Use Download signed PDF below.
        </p>
      ) : null}
      <div ref={hostRef} className="max-h-[75vh] min-h-[120px] overflow-y-auto bg-[#e8e9ef] p-2" />
    </div>
  );
}
