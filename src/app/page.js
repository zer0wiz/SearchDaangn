'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './page.module.css';
import Sidebar from '@/components/Sidebar';
import RegionPopup from '@/components/RegionPopup';
import ProductCard from '@/components/ProductCard';
import { getSelectedRegions, setSelectedRegions as saveCookie } from '@/utils/cookie';

// 지역 상태: pending(대기), loading(로딩), completed(완료)
// regionStatus: { [regionId]: { status: 'pending'|'loading'|'completed', completedAt: Date|null } }

export default function Home() {
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [activeRegionIds, setActiveRegionIds] = useState([]); // IDs of checked regions
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true); // 거래 가능만 보기
  const [regionStatus, setRegionStatus] = useState({}); // 지역별 상태 관리
  const searchAbortRef = useRef(null); // 검색 중단용

  // Load cookies on mount
  useEffect(() => {
    const saved = getSelectedRegions();
    if (saved && saved.length > 0) {
      setSelectedRegions(saved);
      setActiveRegionIds(saved.map((r) => r.id));
    }
  }, []);

  // Filter results based on checked checkboxes and availability
  const visibleItems = searchResults.filter((item) => {
    // If originalRegion is missing for some reason, show it (fallback)
    if (!item.originalRegion) return true;
    const regionMatch = activeRegionIds.includes(item.originalRegion.id);
    // 거래 가능만 보기 필터
    if (showOnlyAvailable && item.status && item.status !== '판매중') {
      return false;
    }
    return regionMatch;
  });

  // 지역별 검색 결과 건수 계산
  const regionCounts = searchResults.reduce((acc, item) => {
    if (item.originalRegion?.id) {
      acc[item.originalRegion.id] = (acc[item.originalRegion.id] || 0) + 1;
    }
    return acc;
  }, {});

  const handleResetFilter = () => {
    setShowOnlyAvailable(true);
  };

  // 단일 지역 검색 함수
  const searchSingleRegion = async (region, searchKeyword) => {
    // 로딩 상태로 변경
    setRegionStatus(prev => ({
      ...prev,
      [region.id]: { status: 'loading', completedAt: null }
    }));

    try {
      const { data } = await axios.post('/api/search-single', {
        region,
        keyword: searchKeyword,
      });

      // 해당 지역의 기존 결과 제거 후 새 결과 추가
      setSearchResults(prev => {
        const filtered = prev.filter(item => item.originalRegion?.id !== region.id);
        return [...filtered, ...(data.items || [])];
      });

      // 완료 상태로 변경
      setRegionStatus(prev => ({
        ...prev,
        [region.id]: { status: 'completed', completedAt: new Date() }
      }));

      return data.items || [];
    } catch (err) {
      console.error(`Error searching region ${region.name3}:`, err);
      // 에러 시에도 완료 처리 (빈 결과)
      setRegionStatus(prev => ({
        ...prev,
        [region.id]: { status: 'completed', completedAt: new Date(), error: true }
      }));
      return [];
    }
  };

  // 개별 지역 리프레쉬
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

  // 지연 함수
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const getRandomDelay = (min = 800, max = 3000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const handleSearch = async (e) => {
    e && e.preventDefault();
    if (!keyword.trim()) return;
    if (selectedRegions.length === 0) {
      alert('지역을 먼저 선택해주세요.');
      setIsPopupOpen(true);
      return;
    }

    // 검색 시작 시 모든 지역을 pending 상태로 초기화
    const initialStatus = {};
    selectedRegions.forEach(region => {
      initialStatus[region.id] = { status: 'pending', completedAt: null };
    });
    setRegionStatus(initialStatus);

    setLoading(true);
    setHasSearched(true);
    setSearchResults([]); // 기존 결과 초기화

    // 순차적으로 각 지역 검색
    for (let i = 0; i < selectedRegions.length; i++) {
      const region = selectedRegions[i];
      await searchSingleRegion(region, keyword);
      
      // 마지막 요청이 아니면 딜레이
      if (i < selectedRegions.length - 1) {
        await delay(getRandomDelay());
      }
    }

    setLoading(false);
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
      <main className={styles.main}>
        <div className={styles.headerContainer}>
          <div className={styles.siteLogo}>
            <svg xmlns="http://www.w3.org/2000/svg" width="140" fill="none" viewBox="0 0 203 114">
              <path fill="#FF6F0F" d="M29.234 36.895C13.09 36.895 0 49.695 0 65.855c0 22.327 29.318 34.175 29.234 34.143-.08.032 29.234-11.816 29.234-34.143 0-16.148-13.089-28.96-29.234-28.96Zm0 40.684A11.069 11.069 0 0 1 18.386 64.34a11.073 11.073 0 0 1 8.702-8.693A11.068 11.068 0 0 1 40.312 66.51a11.07 11.07 0 0 1-11.078 11.088v-.02Z"></path>
              <path fill="#00A05B" d="M35.817 0c-6.823 0-11.574 4.768-12.322 10.4-9.094-2.512-16.22 4.4-16.22 12 0 5.82 3.999 10.52 9.33 12.047 4.299 1.228 12.041.312 12.041.312-.04-1.88 1.692-3.944 4.364-5.824 7.598-5.343 13.54-7.863 14.457-15.151C48.427 6.16 42.767 0 35.817 0Z"></path>
              <path fill="#FF6F0F" d="M116.493 46.963c-6.175 1.94-16.865 2.972-26.907 2.972V37.719h20.74v-9.096H78.465V59.6c17.424 0 32.637-2.1 39.06-4.088l-1.032-8.548ZM131.134 25h-11.106v35.61h11.106V49.448h8.958v-9.716h-8.958V25ZM110.506 60.527c-11.766 0-20.396 6.484-20.396 16 0 9.515 8.639 16 20.396 16 11.758 0 20.396-6.489 20.396-16 0-9.512-8.63-16-20.396-16Zm0 23.091c-5.303 0-9.282-2.544-9.282-7.108 0-4.563 3.979-7.103 9.282-7.103s9.282 2.544 9.282 7.103c0 4.56-3.975 7.108-9.282 7.108ZM161.72 65.25h-11.354v24.092h45.128v-9.536H161.72V65.251ZM194.086 27.971h-44.232v9.536h33.082c0 2.368.112 8-.972 14.4h-40.568v9.864h61.588v-9.848H192.01c1.472-8.088 1.892-14.392 2.076-23.952Z"></path>
            </svg>
            <span>검색기</span>
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