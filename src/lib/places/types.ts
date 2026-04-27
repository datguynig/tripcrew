export type PriceLevel =
  | "PRICE_LEVEL_FREE"
  | "PRICE_LEVEL_INEXPENSIVE"
  | "PRICE_LEVEL_MODERATE"
  | "PRICE_LEVEL_EXPENSIVE"
  | "PRICE_LEVEL_VERY_EXPENSIVE";

export interface PlaceSummary {
  id: string;
  name: string;
  primaryType?: string;
  types: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  formattedAddress?: string;
  location: { latitude: number; longitude: number };
  shortFormattedAddress?: string;
  editorialSummary?: string;
}

export interface PlaceDetails extends PlaceSummary {
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reviews?: Array<{
    rating: number;
    text?: { text: string };
    relativePublishTimeDescription?: string;
  }>;
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
}

export type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: PriceLevel;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  editorialSummary?: { text?: string };
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
  }>;
  photos?: Array<{ name?: string; widthPx?: number; heightPx?: number }>;
};

export function mapToSummary(place: RawPlace): PlaceSummary {
  return {
    id: place.id ?? "",
    name: place.displayName?.text ?? place.id ?? "",
    primaryType: place.primaryType,
    types: place.types ?? [],
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    priceLevel: place.priceLevel,
    formattedAddress: place.formattedAddress,
    shortFormattedAddress: place.shortFormattedAddress,
    location: {
      latitude: place.location?.latitude ?? 0,
      longitude: place.location?.longitude ?? 0,
    },
    editorialSummary: place.editorialSummary?.text,
  };
}

export function mapToDetails(place: RawPlace): PlaceDetails {
  return {
    ...mapToSummary(place),
    internationalPhoneNumber: place.internationalPhoneNumber,
    websiteUri: place.websiteUri,
    googleMapsUri: place.googleMapsUri,
    regularOpeningHours: place.regularOpeningHours,
    reviews: place.reviews
      ?.filter((review): review is Required<NonNullable<RawPlace["reviews"]>[number]> =>
        typeof review.rating === "number",
      )
      .map((review) => ({
        rating: review.rating,
        text: review.text?.text ? { text: review.text.text } : undefined,
        relativePublishTimeDescription: review.relativePublishTimeDescription,
      })),
    photos: place.photos
      ?.filter((photo) => photo.name && photo.widthPx && photo.heightPx)
      .map((photo) => ({
        name: photo.name as string,
        widthPx: photo.widthPx as number,
        heightPx: photo.heightPx as number,
      })),
  };
}
