import { toast } from 'react-hot-toast';

/**
 * Uses browser Geolocation + OpenStreetMap Nominatim to get a readable address.
 * Returns the address string, or null on failure.
 * @param {function} setAddress - state setter to auto-fill the address field
 * @param {function} setLocating - state setter for loading spinner
 * @param {function} [setCoordinates] - optional state setter for {lat, lng} object
 */
export async function fetchCurrentLocation(setAddress, setLocating, setCoordinates) {
  if (!navigator.geolocation) {
    toast.error("Geolocation is not supported by your browser.");
    return;
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
      const { road, neighbourhood, suburb, village, town, city, state_district, state, postcode, country } = data.address;
      
      const area = [road, neighbourhood, suburb, village].filter(Boolean).join(', ');
      const district = [city, town, state_district].filter(Boolean).join(', ');
      
      if (area) formattedAddress += `Area: ${area}\n`;
      if (district) formattedAddress += `District: ${district}\n`;
      if (state) formattedAddress += `Division: ${state}\n`;
      
      const other = [postcode, country].filter(Boolean).join(', ');
      if (other) formattedAddress += `Other: ${other}`;
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
