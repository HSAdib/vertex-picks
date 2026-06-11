import { toast } from 'react-hot-toast';

/**
 * Uses browser Geolocation + OpenStreetMap Nominatim to get a readable address.
 * Returns the address string, or null on failure.
 * @param {function} setAddress - state setter to auto-fill the address field
 * @param {function} setLocating - state setter for loading spinner
 * @param {function} [setCoordinates] - optional state setter for {lat, lng} object
 */
export async function fetchCurrentLocation(setAddress, setLocating, setCoordinates, setPostcode) {
  if (!navigator.geolocation) {
    toast.error("Geolocation is not supported by your browser.");
    return;
  }

  // 1. PERMISSION PRE-CHECK
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'denied') {
        toast.error('Location permission is blocked. Please enable it in your browser settings or type your address manually.');
        return;
      }
    } catch (e) {
      // Ignore if browser doesn't support query correctly
    }
  }

  setLocating(true);
  const loadingToast = toast.loading("Finding your location...");

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });

    const { latitude, longitude } = position.coords;

    // 3. BANGLADESH VALIDATION
    if (latitude < 20.5 || latitude > 26.7 || longitude < 88.0 || longitude > 92.7) {
      toast.error('Location detected outside Bangladesh. Please type your address manually.', { id: loadingToast });
      setLocating(false);
      return;
    }

    if (setCoordinates) {
      setCoordinates({ lat: latitude, lng: longitude });
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`,
      { headers: { 'User-Agent': 'VertexPicks/1.0' } }
    );

    if (!response.ok) throw new Error("Geocoding failed");

    const data = await response.json();
    let formattedAddress = "";

    if (data.address) {
      const { road, neighbourhood, town, city, state_district, state, postcode, country } = data.address;
      
      // 4. CLEANER ADDRESS FORMAT
      const parts = [
        road,
        neighbourhood,
        city || town,
        state_district,
        state,
        postcode,
        country
      ];
      // Use Set to remove potential duplicate names (e.g. city and district might be identical)
      formattedAddress = Array.from(new Set(parts)).filter(Boolean).join(', ');

      if (setPostcode && postcode) {
        setPostcode(`Postal Code: ${postcode}`);
      }
    } else {
      formattedAddress = data.display_name || '';
    }

    if (formattedAddress) {
      setAddress(formattedAddress.trim());
      toast.success("Location found!", { id: loadingToast });
    } else {
      toast.error("Couldn't determine address. Please type manually.", { id: loadingToast });
    }
  } catch (error) {
    // 2. IP-BASED FALLBACK
    try {
      const ipRes = await fetch('https://ip-api.com/json/?fields=status,city,regionName,district,country,countryCode');
      const ipData = await ipRes.json();
      
      if (ipData.status === 'success' && ipData.countryCode === 'BD') {
        const fallbackParts = [ipData.city, ipData.district, ipData.regionName, ipData.country];
        const fallbackAddress = Array.from(new Set(fallbackParts)).filter(Boolean).join(', ');
        
        setAddress(fallbackAddress);
        toast.success('📍 Approximate location used — please verify your address.', { id: loadingToast });
        return;
      }
    } catch (ipErr) {
      // Fall through to the original manual entry error
    }

    if (error.code === 1) {
      toast.error("Location access denied. Please type your address manually.", { id: loadingToast });
    } else if (error.code === 2) {
      toast.error("Location unavailable. Please try again or type manually.", { id: loadingToast });
    } else if (error.code === 3) {
      toast.error("Location request timed out. Please try again.", { id: loadingToast });
    } else {
      toast.error("Failed to get location. Please type manually.", { id: loadingToast });
    }
  } finally {
    setLocating(false);
  }
}
