'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import styles from '../../page.module.css';
import Sidebar from '@/components/Sidebar';
import RegionPopup from '@/components/RegionPopup';
import ProductCard from '@/components/ProductCard';
import { getSelectedRegions, setSelectedRegions as saveCookie } from '@/utils/cookie';

export default function SearchPage() {
  const params = useParams();
  const urlKeyword = decodeURIComponent(params.keyword || '');
  
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [activeRegionIds, setActiveRegionIds] = useState([]);
  const [keyword, setKeyword] = useState(urlKeyword);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [regionStatus, setRegionStatus] = useState({});
  const [viewSize, setViewSize] = useState('medium'); // 보기 크기: small, medium, large
  const searchAbortRef = useRef(null);
  const hasAutoSearched = useRef(false);

  // Load cookies on mount
  useEffect(() => {
    const saved = getSelectedRegions();
    if (saved && saved.length > 0) {
      setSelectedRegions(saved);
      setActiveRegionIds(saved.map((r) => r.id));
    }
  }, []);

  // Auto search when regions are loaded and keyword exists
  useEffect(() => {
    if (urlKeyword && selectedRegions.length > 0 && !hasAutoSearched.current) {
      hasAutoSearched.current = true;
      executeSearch(selectedRegions, urlKeyword);
    }
  }, [selectedRegions, urlKeyword]);

  const visibleItems = searchResults.filter((item) => {
    if (!item.originalRegion) return true;
    const regionMatch = activeRegionIds.includes(item.originalRegion.id);
    if (showOnlyAvailable && item.status && item.status !== '판매중') {
      return false;
    }
    return regionMatch;
  });

  const regionCounts = searchResults.reduce((acc, item) => {
    if (item.originalRegion?.id) {
      acc[item.originalRegion.id] = (acc[item.originalRegion.id] || 0) + 1;
    }
    return acc;
  }, {});

  const handleResetFilter = () => {
    setShowOnlyAvailable(true);
  };

  const searchSingleRegion = async (region, searchKeyword) => {
    setRegionStatus(prev => ({
      ...prev,
      [region.id]: { status: 'loading', completedAt: null }
    }));

    try {
      const { data } = await axios.post('/api/search-single', {
        region,
        keyword: searchKeyword,
      });

      setSearchResults(prev => {
        const filtered = prev.filter(item => item.originalRegion?.id !== region.id);
        return [...filtered, ...(data.items || [])];
      });

      setRegionStatus(prev => ({
        ...prev,
        [region.id]: { status: 'completed', completedAt: new Date() }
      }));

      return data.items || [];
    } catch (err) {
      console.error(`Error searching region ${region.name3}:`, err);
      setRegionStatus(prev => ({
        ...prev,
        [region.id]: { status: 'completed', completedAt: new Date(), error: true }
      }));
      return [];
    }
  };

  const handleRefreshRegion = async (regionId) => {
    if (!keyword.trim()) {
      alert('검색어를 먼저 입력해주세요.');
      return;
    }
    const region = selectedRegions.find(r => r.id === regionId);
    if (region) {
      await searchSingleRegion(region, keyword);
    }
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const getRandomDelay = (min = 800, max = 3000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const executeSearch = async (regions, searchKeyword) => {
    if (!searchKeyword.trim()) return;
    if (regions.length === 0) {
      alert('지역을 먼저 선택해주세요.');
      setIsPopupOpen(true);
      return;
    }

    const initialStatus = {};
    regions.forEach(region => {
      initialStatus[region.id] = { status: 'pending', completedAt: null };
    });
    setRegionStatus(initialStatus);

    setLoading(true);
    setHasSearched(true);
    setSearchResults([]);

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      await searchSingleRegion(region, searchKeyword);
      
      if (i < regions.length - 1) {
        await delay(getRandomDelay());
      }
    }

    setLoading(false);
  };

  const handleSearch = async (e) => {
    e && e.preventDefault();
    await executeSearch(selectedRegions, keyword);
  };

  const handleSaveRegions = (newRegions) => {
    setSelectedRegions(newRegions);
    saveCookie(newRegions);

    const newIds = newRegions.map((r) => r.id);
    setActiveRegionIds(newIds);

    if (keyword.trim()) {
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
    setActiveRegionIds((prev) => prev.filter((rid) => rid !== id));
    setSearchResults((prev) => prev.filter((item) => item.originalRegion?.id !== id));
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <div className={styles.headerContainer}>
          <div className={styles.siteLogo}>
            <div className={styles.logoIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 100 100" fill="none">
                <path d="M50 5 C48 5 46 8 46 12 L46 25 C46 27 48 28 50 28 C52 28 54 27 54 25 L54 12 C54 8 52 5 50 5Z" fill="#4CAF50" />
                <path d="M42 8 C40 6 36 7 35 10 L32 22 C31 24 33 26 35 25 L44 20 C46 19 46 16 44 14 L42 8Z" fill="#66BB6A" />
                <path d="M58 8 C60 6 64 7 65 10 L68 22 C69 24 67 26 65 25 L56 20 C54 19 54 16 56 14 L58 8Z" fill="#66BB6A" />
                <ellipse cx="50" cy="62" rx="38" ry="32" fill="#E1BEE7" />
                <ellipse cx="50" cy="62" rx="30" ry="26" fill="#CE93D8" />
                <ellipse cx="50" cy="62" rx="22" ry="20" fill="#BA68C8" />
                <ellipse cx="50" cy="62" rx="14" ry="14" fill="#AB47BC" />
                <ellipse cx="50" cy="62" rx="6" ry="8" fill="#9C27B0" />
                <ellipse cx="38" cy="52" rx="6" ry="4" fill="rgba(255,255,255,0.3)" transform="rotate(-20 38 52)" />
              </svg>
            </div>
            <div className={styles.logoText}>
              <span className={styles.logoSubtitle}>당근 통합검색기</span>
              <span className={styles.logoTitle}>양파</span>
            </div>
          </div>
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

        <div className={styles.mainContent}>
          <Sidebar
            selectedRegions={selectedRegions}
            activeRegionIds={activeRegionIds}
            onToggle={handleToggleRegion}
            onRemove={handleRemoveRegion}
            showOnlyAvailable={showOnlyAvailable}
            onToggleAvailable={() => setShowOnlyAvailable(!showOnlyAvailable)}
            onResetFilter={handleResetFilter}
            regionCounts={regionCounts}
            regionStatus={regionStatus}
            onRefreshRegion={handleRefreshRegion}
          />
          <div className={styles.content}>
          <div className={styles.viewOptions}>
            <label className={styles.viewSizeLabel}>
              보기 :
              <select
                className={styles.viewSizeSelect}
                value={viewSize}
                onChange={(e) => setViewSize(e.target.value)}
              >
                <option value="small">작게</option>
                <option value="medium">중간</option>
                <option value="large">크게</option>
              </select>
            </label>
          </div>
          {loading && <div className={styles.loading}>당근마켓에서 열심히 찾는 중... 🧅</div>}

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

          <div className={`${styles.grid} ${styles[`grid${viewSize.charAt(0).toUpperCase() + viewSize.slice(1)}`]}`}>
            {visibleItems.map((item, idx) => (
              <ProductCard key={`${item.id}-${idx}`} item={item} size={viewSize} />
            ))}
          </div>
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
