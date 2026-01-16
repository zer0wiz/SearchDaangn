'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import styles from './page.module.css';
import Sidebar from '@/components/Sidebar';
import RegionPopup from '@/components/RegionPopup';
import ProductCard from '@/components/ProductCard';
import { getSelectedRegions, setSelectedRegions as saveCookie } from '@/utils/cookie';

export default function Home() {
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [activeRegionIds, setActiveRegionIds] = useState([]); // IDs of checked regions
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Load cookies on mount
  useEffect(() => {
    const saved = getSelectedRegions();
    if (saved && saved.length > 0) {
      setSelectedRegions(saved);
      setActiveRegionIds(saved.map((r) => r.id));
    }
  }, []);

  // Filter results based on checked checkboxes
  const visibleItems = searchResults.filter((item) => {
    // If originalRegion is missing for some reason, show it (fallback)
    if (!item.originalRegion) return true;
    return activeRegionIds.includes(item.originalRegion.id);
  });

  const handleSearch = async (e) => {
    e && e.preventDefault();
    if (!keyword.trim()) return;
    if (selectedRegions.length === 0) {
      alert('지역을 먼저 선택해주세요.');
      setIsPopupOpen(true);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const { data } = await axios.post('/api/search', {
        regions: selectedRegions,
        keyword: keyword,
      });
      setSearchResults(data.items || []);
    } catch (err) {
      console.error(err);
      alert('검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRegions = (newRegions) => {
    setSelectedRegions(newRegions);
    saveCookie(newRegions);

    // Auto-check new regions
    const newIds = newRegions.map((r) => r.id);
    setActiveRegionIds(newIds);

    // Auto-search if keyword exists? 
    // Maybe better to let user click search, but if results are empty and keyword exists, could be nice.
    // For now, clear results to avoid confusion (results for old region set)
    // Or we could re-trigger search if keyword is present.
    if (keyword.trim()) {
      // We need to trigger search with NEW regions.  
      // Since setState is async, we pass newRegions directly to a helper or just rely on next render?
      // But handleSearch uses state `selectedRegions`.
      // Let's just clear results to force re-search for clarity.
      setSearchResults([]);
      setHasSearched(false);
    }
  };

  const handleToggleRegion = (id) => {
    setActiveRegionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((rid) => rid !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleRemoveRegion = (id) => {
    const newRegions = selectedRegions.filter((r) => r.id !== id);
    setSelectedRegions(newRegions);
    saveCookie(newRegions);

    // Also remove from active
    setActiveRegionIds((prev) => prev.filter((rid) => rid !== id));

    // Remove items from results that belonged to this region
    setSearchResults((prev) => prev.filter((item) => item.originalRegion?.id !== id));
  };

  return (
    <div className={styles.container}>
      <Sidebar
        selectedRegions={selectedRegions}
        activeRegionIds={activeRegionIds}
        onToggle={handleToggleRegion}
        onRemove={handleRemoveRegion}
      />

      <main className={styles.main}>
        <div className={styles.headerContainer}>
          <form onSubmit={handleSearch} className={styles.searchBar}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="검색할 물건을 입력하세요."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button type="submit" className={styles.searchBtn} disabled={loading}>
              {loading ? '검색중...' : '검색'}
            </button>
          </form>
          <button
            className={styles.addRegionBtn}
            onClick={() => setIsPopupOpen(true)}
          >
            + 지역 추가
          </button>
        </div>

        <div className={styles.content}>
          {loading && <div className={styles.loading}>당근마켓에서 열심히 찾는 중... 🥕</div>}

          {!loading && hasSearched && visibleItems.length === 0 && (
            <div className={styles.noResults}>
              {searchResults.length > 0
                ? '선택된 지역의 결과가 숨겨졌습니다. 사이드바에서 지역을 체크해주세요.'
                : '검색 결과가 없습니다.'}
            </div>
          )}

          {!loading && !hasSearched && selectedRegions.length > 0 && (
            <div className={styles.placeholder}>
              물품을 검색해보세요.
            </div>
          )}

          {(!loading && selectedRegions.length === 0) && (
            <div className={styles.placeholder}>
              먼저 지역을 추가해주세요.
            </div>
          )}

          <div className={styles.grid}>
            {visibleItems.map((item, idx) => (
              <ProductCard key={`${item.id}-${idx}`} item={item} />
            ))}
          </div>
        </div>
      </main>

      {isPopupOpen && (
        <RegionPopup
          isOpen={true}
          onClose={() => setIsPopupOpen(false)}
          onSave={handleSaveRegions}
          initialSelected={selectedRegions}
        />
      )}
    </div>
  );
}
