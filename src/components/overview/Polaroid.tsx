"use client";

type PolaroidProps = {
  imageUrl: string;
  alt: string;
  caption: string;
  subcaption?: string | null;
  tilt: number;
  offsetX?: number;
  offsetY?: number;
  zIndex?: number;
  onSwapClick?: () => void;
  onReorderClick?: () => void;
  onOpenClick?: () => void;
};

export function Polaroid({
  imageUrl,
  alt,
  caption,
  subcaption,
  tilt,
  offsetX = 0,
  offsetY = 0,
  zIndex,
  onSwapClick,
  onReorderClick,
  onOpenClick,
}: PolaroidProps) {
  return (
    <div
      className="absolute top-1/2 left-1/2"
      style={{
        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${tilt}deg)`,
        zIndex,
      }}
    >
      <div className="group/pol w-[220px] max-[900px]:w-[170px] transition-transform duration-200 ease-out hover:-translate-y-1 will-change-transform">
        <div className="relative bg-[#fafaf7] border border-[#e9e9e2] p-[10px] pb-[44px] rounded-[2px]">
          <div className="relative aspect-[4/5] overflow-hidden bg-[#e9e9e2]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={alt}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover select-none"
            />
            {onOpenClick && (
              <button
                type="button"
                onClick={onOpenClick}
                aria-label={`Open photo · ${caption}`}
                className="absolute inset-0 z-[1] cursor-zoom-in"
              />
            )}
          </div>

          <div className="absolute left-[10px] right-[10px] bottom-[10px] h-[34px] flex flex-col justify-center">
            <div className="label-xs tracking-[0.14em] text-[#0a0a0b] truncate">
              {caption}
            </div>
            {subcaption && (
              <div className="font-mono text-[9px] tracking-[0.12em] text-[#6a6a70] truncate mt-[2px]">
                {subcaption}
              </div>
            )}
          </div>

          {(onSwapClick || onReorderClick) && (
            <div className="absolute top-[8px] right-[8px] z-[2] flex gap-1 opacity-0 group-hover/pol:opacity-100 focus-within:opacity-100 max-[780px]:opacity-80 transition-opacity">
              {onSwapClick && (
                <button
                  type="button"
                  onClick={onSwapClick}
                  aria-label="Swap this polaroid's content"
                  className="bg-bg/70 backdrop-blur-md border border-line text-fg-2 hover:text-fg hover:border-line-2 label-xs tracking-[0.14em] px-[8px] py-[4px] cursor-pointer transition-colors"
                >
                  SWAP
                </button>
              )}
              {onReorderClick && (
                <button
                  type="button"
                  onClick={onReorderClick}
                  aria-label="Reorder this polaroid"
                  className="bg-bg/70 backdrop-blur-md border border-line text-fg-2 hover:text-fg hover:border-line-2 w-[30px] h-[22px] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 4 L3 8 L7 12" />
                    <path d="M3 8 h14" />
                    <path d="M17 12 L21 16 L17 20" />
                    <path d="M21 16 h-14" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
