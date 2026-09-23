import { useEffect, useRef, useState } from 'react';

interface PdfInlineViewerProps {
  src: string;
  title: string;
}

const MIN_PAGE_CSS_WIDTH = 794;

export function PdfInlineViewer({ src, title }: PdfInlineViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [zoom, setZoom] = useState(1);

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

      const bytes = await fetch(src).then((response) => {
        if (!response.ok) throw new Error('Could not load the agreement PDF.');
        return response.arrayBuffer();
      });
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(bytes),
        cMapUrl: '/pdfjs/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/pdfjs/standard_fonts/',
      }).promise;
      pdfDoc = pdf;
      if (cancelled) {
        await pdf.destroy();
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const fitWidth = host.clientWidth || host.parentElement?.clientWidth || 320;
      const cssWidth = Math.round(Math.max(MIN_PAGE_CSS_WIDTH, fitWidth) * zoom);

      for (let number = 1; number <= pdf.numPages; number += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const cssScale = cssWidth / base.width;
        const viewport = page.getViewport({ scale: cssScale * dpr });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) continue;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${Math.floor(base.height * cssScale)}px`;
        canvas.className = 'public-pdf-page';
        canvas.setAttribute('aria-label', `${title} page ${number}`);
        context.imageSmoothingEnabled = false;
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          intent: 'print',
        }).promise;
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
  }, [src, title, zoom]);

  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#f4f6f9] px-3 py-2">
        <p className="text-xs font-semibold text-[#1f2130]">{title}</p>
        <div className="flex items-center gap-2">
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-[#1f2130]"
          >
            Open
          </a>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-[#1f2130]"
            onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.2).toFixed(1))))}
          >
            −
          </button>
          <span className="w-10 text-center text-xs text-[#424665]">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-[#1f2130]"
            onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(1))))}
          >
            +
          </button>
        </div>
      </div>
      {status === 'loading' ? (
        <p className="px-4 py-16 text-center text-sm text-[#424665]">Loading agreement…</p>
      ) : null}
      {status === 'error' ? (
        <p className="px-4 py-16 text-center text-sm text-red-600">
          Could not display the agreement on this screen. Use Open to view the PDF in a new tab.
        </p>
      ) : null}
      <div ref={hostRef} className="max-h-[75vh] min-h-[160px] overflow-auto bg-[#e8e9ef] p-2" />
    </div>
  );
}
