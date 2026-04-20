"use client";

import { useMemo } from "react";

/**
 * Server-rendered Mapbox static image. Takes lon/lat, emits an <img>
 * pointing at the Mapbox Static Images API. Uses the same token as the
 * search box (NEXT_PUBLIC_MAPBOX_TOKEN). Falls back to null render if
 * the token is missing.
 *
 * Docs: https://docs.mapbox.com/api/maps/static-images/
 */

type Props = {
  longitude: number;
  latitude: number;
  zoom?: number;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
};

export function StaticMap({
  longitude,
  latitude,
  zoom = 5,
  width = 260,
  height = 140,
  alt = "Map",
  className = "",
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const src = useMemo(() => {
    if (!token) return null;
    const pin = `pin-s+FF4C15(${longitude},${latitude})`;
    const viewport = `${longitude},${latitude},${zoom},0`;
    // @2x for retina, explicit size
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pin}/${viewport}/${width}x${height}@2x?access_token=${token}`;
  }, [token, longitude, latitude, zoom, width, height]);

  if (!src) return null;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      className={`border border-line rounded-md ${className}`}
    />
  );
}
