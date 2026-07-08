import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const fetchShopData = async () => {
  const querySnapshot = await getDocs(collection(db, 'mangoes'));
  const productsArray = [];
  let fetchedCategories = [];
  let fetchedFilters = { rating: [], season: [], weight: [], priceRange: [], variety: [] };

  querySnapshot.docs.forEach(d => {
    if (d.id === 'CATEGORIES') {
      fetchedCategories = d.data().list || [];
    } else if (d.id === 'FILTERS') {
      fetchedFilters = d.data() || fetchedFilters;
    } else if (d.id !== 'STORE_SECTIONS' && d.id !== 'NAVBAR_TABS' && d.id !== 'STORE_SETTINGS' && d.id !== 'VARIETIES' && d.id !== 'PACKAGING_OPTIONS' && d.id !== 'DELIVERY_OPTIONS') {
      productsArray.push({ id: d.id, ...d.data() });
    }
  });

  productsArray.sort((a, b) => (a.order || 0) - (b.order || 0));

  const isFiltersEmpty = !fetchedFilters.variety?.length && !fetchedFilters.weight?.length && !fetchedFilters.season?.length;
  if (isFiltersEmpty) {
    fetchedFilters = {
      variety: ['Himsagar', 'Langra', 'Fazli', 'Gopalbhog', 'Amrapali', 'Gift Box'],
      weight: ['5kg', '10kg', '20kg'],
      season: ['Early Season', 'Peak Season', 'Late Season'],
      priceRange: ['0-500', '501-1000', '1000+'],
      rating: fetchedFilters.rating || []
    };
  }

  const normalizedFilters = {
    rating: fetchedFilters.rating || [],
    season: fetchedFilters.season || [],
    weight: fetchedFilters.weight || [],
    priceRange: fetchedFilters.priceRange || [],
    variety: fetchedFilters.variety || []
  };

  return { 
    mangoes: productsArray, 
    categories: fetchedCategories, 
    filters: normalizedFilters 
  };
};
