import Cookies from 'js-cookie';

const COOKIE_NAME = 'daangn_selected_regions';

export const getSelectedRegions = () => {
  const cookie = Cookies.get(COOKIE_NAME);
  try {
    return cookie ? JSON.parse(cookie) : [];
  } catch (e) {
    console.error('Failed to parse regions cookie:', e);
    return [];
  }
};

export const setSelectedRegions = (regions) => {
  // Store for 365 days
  Cookies.set(COOKIE_NAME, JSON.stringify(regions), { expires: 365 });
};

export const addRegion = (region) => {
  const current = getSelectedRegions();
  // Avoid duplicates by ID
  if (!current.some(r => r.id === region.id)) {
    const updated = [...current, region];
    setSelectedRegions(updated);
    return updated;
  }
  return current;
};

export const removeRegion = (regionId) => {
  const current = getSelectedRegions();
  const updated = current.filter(r => r.id !== regionId);
  setSelectedRegions(updated);
  return updated;
};
