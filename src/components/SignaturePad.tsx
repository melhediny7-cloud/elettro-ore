import React, { useRef, useState, useEffect } from 'react';
import { PenTool, RotateCcw, Check } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  initialSignature?: string | null;
  onSaveSignature: (dataUrl: string | null) => void;
  lang?: 'it' | 'ar';
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  initialSignature,
  onSaveSignature,
  lang = 'it',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialSignature);
  const [isSaved, setIsSaved] = useState(!!initialSignature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0f172a';

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
      };
      img.src = initialSignature;
      setHasSignature(true);
      setIsSaved(true);
    }
  }, [initialSignature]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setIsSaved(false);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      setIsSaved(true);
      onSaveSignature(dataUrl);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setIsSaved(false);
    onSaveSignature(null);
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-blue-600" />
          <span>{label}</span>
        </label>
        {isSaved && (
          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {lang === 'ar' ? 'تم الحفظ' : 'Salvata'}
          </span>
        )}
      </div>

      <div className="relative bg-white border border-slate-300 rounded-lg overflow-hidden shadow-inner h-24 touch-none">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair block"
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-xs font-medium italic">
            {lang === 'ar' ? 'وقّع بإصبعك هنا...' : 'Firma qui con il dito...'}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleClear}
          className="px-2.5 py-1 text-slate-500 hover:text-rose-600 text-xs font-semibold flex items-center gap-1 rounded hover:bg-slate-100 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{lang === 'ar' ? 'مسح' : 'Pulisci'}</span>
        </button>

        <span className="text-[10px] text-slate-400 font-medium">
          {lang === 'ar' ? 'توقيع رسمي معتمد في التقرير' : 'Firma valida per il report'}
        </span>
      </div>
    </div>
  );
};
