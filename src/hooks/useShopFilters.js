import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function useShopFilters() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const urlSearch = queryParams.get('search');
  const urlCategory = queryParams.get('category');

  const [searchQuery, setSearchQuery] = useState(urlSearch || '');
  const [selectedCategories, setSelectedCategories] = useState(urlCategory ? [urlCategory] : []);
  const [selectedVarieties, setSelectedVarieties] = useState([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState([]);
  const [selectedWeights, setSelectedWeights] = useState([]);
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [minRating, setMinRating] = useState(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sortOption, setSortOption] = useState('featured');
  const [viewMode, setViewMode] = useState('grid');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Navigation is an external source of truth; this intentionally synchronizes local input state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery(urlSearch || '');
  }, [urlSearch]);

  useEffect(() => {
    // Navigation is an external source of truth; this intentionally synchronizes local filter state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedCategories(urlCategory ? [urlCategory] : []);
  }, [urlCategory]);

  const clearAllFilters = () => {
    setSelectedCategories([]); setSelectedVarieties([]); setSelectedPriceRanges([]);
    setSelectedWeights([]); setSelectedSeasons([]); setMinRating(null);
    setInStockOnly(false); setOnSaleOnly(false); setSearchQuery('');
  };

  return {
    searchQuery, setSearchQuery,
    selectedCategories, setSelectedCategories,
    selectedVarieties, setSelectedVarieties,
    selectedPriceRanges, setSelectedPriceRanges,
    selectedWeights, setSelectedWeights,
    selectedSeasons, setSelectedSeasons,
    minRating, setMinRating,
    inStockOnly, setInStockOnly,
    onSaleOnly, setOnSaleOnly,
    sortOption, setSortOption,
    viewMode, setViewMode,
    isSidebarOpen, setIsSidebarOpen,
    clearAllFilters,
    urlCategory
  };
}
