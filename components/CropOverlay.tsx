import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SelectionBox } from '../types';

interface CropOverlayProps {
  imageSrc: string;
  onConfirm: (croppedImageBase64: string) => void;
  onCancel: () => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImgElement(img);
      draw(img, null);
    };
  }, [imageSrc]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (imgElement) draw(imgElement, selection);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imgElement, selection]);

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const draw = (img: HTMLImageElement, currentSelection: SelectionBox | null) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Fit canvas to container while maintaining aspect ratio
    const containerAspect = container.clientWidth / container.clientHeight;
    const imgAspect = img.width / img.height;

    let renderWidth, renderHeight;

    if (containerAspect > imgAspect) {
      renderHeight = container.clientHeight;
      renderWidth = renderHeight * imgAspect;
    } else {
      renderWidth = container.clientWidth;
      renderHeight = renderWidth / imgAspect;
    }

    canvas.width = renderWidth;
    canvas.height = renderHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw Image
    ctx.drawImage(img, 0, 0, renderWidth, renderHeight);

    // Draw Dark Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, renderWidth, renderHeight);

    // Draw Selection (Clear Rect + Border)
    if (currentSelection) {
      ctx.clearRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
      ctx.drawImage(
        img, 
        (currentSelection.x / renderWidth) * img.width, 
        (currentSelection.y / renderHeight) * img.height,
        (currentSelection.width / renderWidth) * img.width,
        (currentSelection.height / renderHeight) * img.height,
        currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height
      );

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentSelection.x, currentSelection.y, currentSelection.width, currentSelection.height);
    }
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    const coords = getCanvasCoordinates(e);
    setStartPos(coords);
    setIsDrawing(true);
    setSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !imgElement) return;
    e.preventDefault();
    const coords = getCanvasCoordinates(e);
    
    const newSelection = {
      x: Math.min(coords.x, startPos.x),
      y: Math.min(coords.y, startPos.y),
      width: Math.abs(coords.x - startPos.x),
      height: Math.abs(coords.y - startPos.y)
    };

    setSelection(newSelection);
    draw(imgElement, newSelection);
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleCrop = () => {
    if (!selection || !imgElement || !canvasRef.current) return;
    if (selection.width < 10 || selection.height < 10) {
      alert("لطفا ناحیه بزرگتری را انتخاب کنید");
      return;
    }

    const tempCanvas = document.createElement('canvas');
    const scaleX = imgElement.width / canvasRef.current.width;
    const scaleY = imgElement.height / canvasRef.current.height;

    const realW = selection.width * scaleX;
    const realH = selection.height * scaleY;
    const realX = selection.x * scaleX;
    const realY = selection.y * scaleY;

    tempCanvas.width = realW;
    tempCanvas.height = realH;
    const ctx = tempCanvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(imgElement, realX, realY, realW, realH, 0, 0, realW, realH);
      const base64 = tempCanvas.toDataURL('image/png');
      onConfirm(base64);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center bg-slate-900">
        <h2 className="text-white font-bold">انتخاب ناحیه برای خواندن</h2>
        <div className="flex gap-2">
           <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-300 hover:text-white">لغو</button>
           <button 
             onClick={handleCrop} 
             disabled={!selection || selection.width === 0}
             className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
           >
             تایید و خواندن
           </button>
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden relative touch-none flex items-center justify-center bg-slate-800"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="cursor-crosshair shadow-2xl"
        />
      </div>
      
      <div className="p-4 bg-slate-900 text-center text-sm text-slate-400">
        برای انتخاب متن، کادر بکشید
      </div>
    </div>
  );
};