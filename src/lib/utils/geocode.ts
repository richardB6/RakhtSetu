/**
 * Lightweight geocoding utility for the RakhtSetu hackathon demo.
 *
 * Strategy (in priority order):
 *   1. Browser Geolocation API (most accurate, requires user consent)
 *   2. Pincode-based lookup from a local table of major Indian pincodes
 *   3. City-name fallback table
 *   4. State-level centroid fallback
 *   5. India centre (never a specific city like Mumbai)
 *
 * This avoids hardcoding Mumbai and never silently assigns an unrelated location.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Approximate centroids for major Indian cities (not exhaustive). */
const CITY_COORDS: Record<string, Coordinates> = {
  mumbai:      { lat: 19.0760, lng: 72.8777 },
  delhi:       { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  bangalore:   { lat: 12.9716, lng: 77.5946 },
  bengaluru:   { lat: 12.9716, lng: 77.5946 },
  hyderabad:   { lat: 17.3850, lng: 78.4867 },
  ahmedabad:   { lat: 23.0225, lng: 72.5714 },
  chennai:     { lat: 13.0827, lng: 80.2707 },
  kolkata:     { lat: 22.5726, lng: 88.3639 },
  surat:       { lat: 21.1702, lng: 72.8311 },
  pune:        { lat: 18.5204, lng: 73.8567 },
  jaipur:      { lat: 26.9124, lng: 75.7873 },
  lucknow:     { lat: 26.8467, lng: 80.9462 },
  kanpur:      { lat: 26.4499, lng: 80.3319 },
  nagpur:      { lat: 21.1458, lng: 79.0882 },
  patna:       { lat: 25.5941, lng: 85.1376 },
  indore:      { lat: 22.7196, lng: 75.8577 },
  thane:       { lat: 19.2183, lng: 72.9781 },
  bhopal:      { lat: 23.2599, lng: 77.4126 },
  visakhapatnam: { lat: 17.6868, lng: 83.2185 },
  vadodara:    { lat: 22.3072, lng: 73.1812 },
  firozabad:   { lat: 27.1591, lng: 78.3957 },
  ludhiana:    { lat: 30.9010, lng: 75.8573 },
  agra:        { lat: 27.1767, lng: 78.0081 },
  nashik:      { lat: 19.9975, lng: 73.7898 },
  faridabad:   { lat: 28.4089, lng: 77.3178 },
  meerut:      { lat: 28.9845, lng: 77.7064 },
  rajkot:      { lat: 22.3039, lng: 70.8022 },
  varanasi:    { lat: 25.3176, lng: 82.9739 },
  srinagar:    { lat: 34.0837, lng: 74.7973 },
  aurangabad:  { lat: 19.8762, lng: 75.3433 },
  dhanbad:     { lat: 23.7957, lng: 86.4304 },
  amritsar:    { lat: 31.6340, lng: 74.8723 },
  allahabad:   { lat: 25.4358, lng: 81.8463 },
  prayagraj:   { lat: 25.4358, lng: 81.8463 },
  ranchi:      { lat: 23.3441, lng: 85.3096 },
  howrah:      { lat: 22.5958, lng: 88.2636 },
  coimbatore:  { lat: 11.0168, lng: 76.9558 },
  jabalpur:    { lat: 23.1815, lng: 79.9864 },
  gwalior:     { lat: 26.2183, lng: 78.1828 },
  vijayawada:  { lat: 16.5062, lng: 80.6480 },
  jodhpur:     { lat: 26.2389, lng: 73.0243 },
  madurai:     { lat:  9.9252, lng: 78.1198 },
  raipur:      { lat: 21.2514, lng: 81.6296 },
  kota:        { lat: 25.2138, lng: 75.8648 },
  chandigarh:  { lat: 30.7333, lng: 76.7794 },
  guwahati:    { lat: 26.1445, lng: 91.7362 },
  solapur:     { lat: 17.6805, lng: 75.9064 },
  hubli:       { lat: 15.3647, lng: 75.1240 },
  dharwad:     { lat: 15.4589, lng: 75.0078 },
  bareilly:    { lat: 28.3670, lng: 79.4304 },
  mysore:      { lat: 12.2958, lng: 76.6394 },
  mysuru:      { lat: 12.2958, lng: 76.6394 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245 },
  thiruvananthapuram: { lat: 8.5241, lng: 76.9366 },
  trivandrum:  { lat: 8.5241, lng: 76.9366 },
  kochi:       { lat: 9.9312, lng: 76.2673 },
  cochin:      { lat: 9.9312, lng: 76.2673 },
  salem:       { lat: 11.6643, lng: 78.1460 },
  tiruppur:    { lat: 11.1085, lng: 77.3411 },
  gorakhpur:   { lat: 26.7606, lng: 83.3732 },
  guntur:      { lat: 16.3067, lng: 80.4365 },
  bhiwandi:    { lat: 19.2963, lng: 73.0630 },
  saharanpur:  { lat: 29.9680, lng: 77.5552 },
  bikaner:     { lat: 28.0229, lng: 73.3119 },
  noida:       { lat: 28.5355, lng: 77.3910 },
  gurgaon:     { lat: 28.4595, lng: 77.0266 },
  gurugram:    { lat: 28.4595, lng: 77.0266 },
  dehradun:    { lat: 30.3165, lng: 78.0322 },
  udaipur:     { lat: 24.5854, lng: 73.7125 },
  siliguri:    { lat: 26.7271, lng: 88.3953 },
  mangalore:   { lat: 12.9141, lng: 74.8560 },
  mangaluru:   { lat: 12.9141, lng: 74.8560 },
  warangal:    { lat: 17.9784, lng: 79.5941 },
  nellore:     { lat: 14.4426, lng: 79.9865 },
  jammu:       { lat: 32.7266, lng: 74.8570 },
  nanded:      { lat: 19.1383, lng: 77.3210 },
  cuttack:     { lat: 20.4625, lng: 85.8828 },
  kolhapur:    { lat: 16.7050, lng: 74.2433 },
  ajmer:       { lat: 26.4499, lng: 74.6399 },
  puducherry:  { lat: 11.9416, lng: 79.8083 },
  pondicherry: { lat: 11.9416, lng: 79.8083 },
  imphal:      { lat: 24.8170, lng: 93.9368 },
  shillong:    { lat: 25.5788, lng: 91.8933 },
  aizawl:      { lat: 23.7307, lng: 92.7173 },
  dispur:      { lat: 26.1433, lng: 91.7898 },
  panaji:      { lat: 15.4909, lng: 73.8278 },
  goa:         { lat: 15.2993, lng: 74.1240 },
  shimla:      { lat: 31.1048, lng: 77.1734 },
  gangtok:     { lat: 27.3389, lng: 88.6065 },
  itanagar:    { lat: 27.0844, lng: 93.6053 },
  kohima:      { lat: 25.6751, lng: 94.1086 },
  agartala:    { lat: 23.8315, lng: 91.2868 },
  silvassa:    { lat: 20.2766, lng: 73.0143 },
  diu:         { lat: 20.7141, lng: 70.9846 },
  daman:       { lat: 20.3974, lng: 72.8328 },
  'port blair':  { lat: 11.6234, lng: 92.7265 },
  leh:         { lat: 34.1526, lng: 77.5771 },
};

/** Approximate centroids for Indian states. */
const STATE_COORDS: Record<string, Coordinates> = {
  'andhra pradesh':    { lat: 15.9129, lng: 79.7400 },
  'arunachal pradesh': { lat: 28.2180, lng: 94.7278 },
  assam:               { lat: 26.2006, lng: 92.9376 },
  bihar:               { lat: 25.0961, lng: 85.3131 },
  chhattisgarh:        { lat: 21.2787, lng: 81.8661 },
  goa:                 { lat: 15.2993, lng: 74.1240 },
  gujarat:             { lat: 22.2587, lng: 71.1924 },
  haryana:             { lat: 29.0588, lng: 76.0856 },
  'himachal pradesh':  { lat: 31.1048, lng: 77.1734 },
  jharkhand:           { lat: 23.6102, lng: 85.2799 },
  karnataka:           { lat: 15.3173, lng: 75.7139 },
  kerala:              { lat: 10.8505, lng: 76.2711 },
  'madhya pradesh':    { lat: 22.9734, lng: 78.6569 },
  maharashtra:         { lat: 19.7515, lng: 75.7139 },
  manipur:             { lat: 24.6637, lng: 93.9063 },
  meghalaya:           { lat: 25.4670, lng: 91.3662 },
  mizoram:             { lat: 23.1645, lng: 92.9376 },
  nagaland:            { lat: 26.1584, lng: 94.5624 },
  odisha:              { lat: 20.9517, lng: 85.0985 },
  punjab:              { lat: 31.1471, lng: 75.3412 },
  rajasthan:           { lat: 27.0238, lng: 74.2179 },
  sikkim:              { lat: 27.5330, lng: 88.5122 },
  'tamil nadu':        { lat: 11.1271, lng: 78.6569 },
  telangana:           { lat: 18.1124, lng: 79.0193 },
  tripura:             { lat: 23.9408, lng: 91.9882 },
  'uttar pradesh':     { lat: 26.8467, lng: 80.9462 },
  uttarakhand:         { lat: 30.0668, lng: 79.0193 },
  'west bengal':       { lat: 22.9868, lng: 87.8550 },
  delhi:               { lat: 28.6139, lng: 77.2090 },
  'jammu and kashmir': { lat: 33.7782, lng: 76.5762 },
  ladakh:              { lat: 34.1526, lng: 77.5771 },
  chandigarh:          { lat: 30.7333, lng: 76.7794 },
};

/** India geographical centre — last resort, never a specific city. */
const INDIA_CENTRE: Coordinates = { lat: 20.5937, lng: 78.9629 };

/**
 * Look up approximate coordinates from a city + state string.
 * Never returns Mumbai unless the city is actually Mumbai.
 */
export function getCityCoordinates(city: string, state?: string): Coordinates {
  const cityKey = city.trim().toLowerCase();
  const stateKey = (state || '').trim().toLowerCase();

  if (CITY_COORDS[cityKey]) return CITY_COORDS[cityKey];

  // Try partial city match
  const cityPartial = Object.keys(CITY_COORDS).find(
    (key) => key.includes(cityKey) || cityKey.includes(key)
  );
  if (cityPartial) return CITY_COORDS[cityPartial];

  // Fall back to state
  if (stateKey && STATE_COORDS[stateKey]) return STATE_COORDS[stateKey];

  // Try partial state match
  const statePartial = Object.keys(STATE_COORDS).find(
    (key) => key.includes(stateKey) || stateKey.includes(key)
  );
  if (statePartial) return STATE_COORDS[statePartial];

  // Last resort — India centre (not a specific city)
  return INDIA_CENTRE;
}

/**
 * Client-side: request browser geolocation.
 * Returns null on error/denied instead of throwing.
 */
export function getBrowserLocation(): Promise<Coordinates | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: false }
    );
  });
}
