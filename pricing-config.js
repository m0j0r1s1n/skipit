// Change prices only in this object. Browser displays and server estimates use it.
export const PRICING = Object.freeze({
  trailer_6x4: Object.freeze({
    name: "6 × 4 ft Single Axle Trailer",
    bookingValue: "6' x 4' Heavy Duty Trailer",
    price_8_hours: 90,
    price_24_hours: 120
  }),
  trailer_10x5: Object.freeze({
    name: "10 × 5 ft Twin Axle Trailer",
    bookingValue: "10' X 5' Trailer",
    price_8_hours: null,
    price_24_hours: null
  }),
  dump_runs: Object.freeze({
    name: "Dump Runs & House Clearances",
    bookingValue: "Dump Runs & House Clearances",
    starting_price: 50
  })
});

export const HIRE_DURATIONS = Object.freeze({
  EIGHT_HOURS: "8_hours",
  TWENTY_FOUR_HOURS: "24_hours"
});

export function formatPrice(value) {
  return value === null || value === undefined ? "Contact us for a quote" : `£${value}`;
}

export function pricingForBookingValue(bookingValue) {
  return Object.values(PRICING).find(item => item.bookingValue === bookingValue) || null;
}

export function isSupportedDuration(duration) {
  return Object.values(HIRE_DURATIONS).includes(duration);
}

export function calculateConfiguredPrice(bookingValue, duration, dayCount = 1) {
  const pricing = pricingForBookingValue(bookingValue);
  if (!pricing) return null;
  if (pricing.starting_price !== undefined) return pricing.starting_price;
  if (!isSupportedDuration(duration)) return null;
  if (duration === HIRE_DURATIONS.EIGHT_HOURS) return pricing.price_8_hours;
  if (pricing.price_24_hours === null) return null;
  return pricing.price_24_hours * Math.max(1, dayCount);
}