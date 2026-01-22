'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './page.module.css';
import Sidebar from '@/components/Sidebar';
import RegionPopup from '@/components/RegionPopup';
import SearchResultsView from '@/components/SearchResultsView';
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
  const [includeTags, setIncludeTags] = useState([]); // 포함할 단어
  const [excludeTags, setExcludeTags] = useState([]); // 제외할 단어
  const [searchCache, setSearchCache] = useState({}); // 검색 캐시: { [cacheKey]: { items: [], timestamp: number } }
  const [rateLimitMessage, setRateLimitMessage] = useState(null); // 제한 메시지
  const searchAbortRef = useRef(null); // 검색 중단용

  // Load cookies on mount
  useEffect(() => {
    const saved = getSelectedRegions();
    if (saved && saved.length > 0) {
      setSelectedRegions(saved);
      setActiveRegionIds(saved.map((r) => r.id));
    }
  }, []);

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
    const cacheKey = `${region.id}-${searchKeyword}`;
    const now = Date.now();
    const cached = searchCache[cacheKey];

    // 1분(60000ms) 이내 동일 검색어/지역 체크
    if (cached && (now - cached.timestamp) < 60000) {
      const remainingSec = Math.ceil((60000 - (now - cached.timestamp)) / 1000);
      setRateLimitMessage({
        message: `1분 이내 동일한 검색은 불가능합니다.`,
        remaining: remainingSec
      });

      // 캐시된 결과 사용
      setSearchResults(prev => {
        const filtered = prev.filter(item => item.originalRegion?.id !== region.id);
        return [...filtered, ...(cached.items || [])];
      });

      // 완료 상태로 변경
      setRegionStatus(prev => ({
        ...prev,
        [region.id]: { status: 'completed', completedAt: new Date(cached.timestamp) }
      }));

      return cached.items || [];
    }

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

      const items = data.items || [];

      // 캐시 저장
      setSearchCache(prev => ({
        ...prev,
        [cacheKey]: { items, timestamp: Date.now() }
      }));

      // 해당 지역의 기존 결과 제거 후 새 결과 추가
      setSearchResults(prev => {
        const filtered = prev.filter(item => item.originalRegion?.id !== region.id);
        return [...filtered, ...items];
      });

      // 완료 상태로 변경
      setRegionStatus(prev => ({
        ...prev,
        [region.id]: { status: 'completed', completedAt: new Date() }
      }));

      return items;
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

  // 메시지 자동 삭제 타이머 및 잔여 시간 카운트다운
  useEffect(() => {
    if (rateLimitMessage) {
      const timer = setInterval(() => {
        setRateLimitMessage(prev => {
          if (!prev) return null;
          if (prev.remaining <= 1) return null;
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [rateLimitMessage]);

  // 개별 지역 리프레쉬
  const handleRefreshRegion = async (regionId) => {
    if (!keyword.trim()) {
      alert('검색어를 먼저 입력해주세요.');
      return;
    }
    const region = selectedRegions.find(r => r.id === regionId);
    if (region) {
      setRateLimitMessage(null); // 메시지 초기화
      await searchSingleRegion(region, keyword);
    }
  };

  // 지연 함수
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const getRandomDelay = (min = 1500, max = 5000) => {
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

    setRateLimitMessage(null); // 메시지 초기화

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
        // 캐시된 결과가 아니면 딜레이 적용 (캐시 체크 로직이 searchSingleRegion 내부에 있음)
        // 여기서는 단순하게 유지하거나, searchSingleRegion의 반환값으로 캐시 여부를 판단할 수 있음
        await delay(getRandomDelay(500, 1500));
      }
    }

    setLoading(false);
  };

  const handleSaveRegions = async (newRegions) => {
    // 새로 추가된 지역 찾기
    const existingIds = selectedRegions.map(r => r.id);
    const addedRegions = newRegions.filter(r => !existingIds.includes(r.id));

    setSelectedRegions(newRegions);
    saveCookie(newRegions);

    // Auto-check new regions
    const newIds = newRegions.map((r) => r.id);
    setActiveRegionIds(newIds);

    // 검색어가 있고 새로 추가된 지역이 있으면 해당 지역만 검색
    if (keyword.trim() && addedRegions.length > 0 && hasSearched) {
      // 새 지역들을 pending 상태로 설정
      const addedStatus = {};
      addedRegions.forEach(region => {
        addedStatus[region.id] = { status: 'pending', completedAt: null };
      });
      setRegionStatus(prev => ({ ...prev, ...addedStatus }));

      // 새로 추가된 지역만 순차 검색
      for (let i = 0; i < addedRegions.length; i++) {
        const region = addedRegions[i];
        await searchSingleRegion(region, keyword);
        
        if (i < addedRegions.length - 1) {
          await delay(getRandomDelay());
        }
      }
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
            <div className={styles.logoIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 100 100" fill="none">
                {/* 양파 줄기 */}
                <path d="M50 5 C48 5 46 8 46 12 L46 25 C46 27 48 28 50 28 C52 28 54 27 54 25 L54 12 C54 8 52 5 50 5Z" fill="#4CAF50" />
                <path d="M42 8 C40 6 36 7 35 10 L32 22 C31 24 33 26 35 25 L44 20 C46 19 46 16 44 14 L42 8Z" fill="#66BB6A" />
                <path d="M58 8 C60 6 64 7 65 10 L68 22 C69 24 67 26 65 25 L56 20 C54 19 54 16 56 14 L58 8Z" fill="#66BB6A" />
                {/* 양파 몸통 - 여러 겹 */}
                <ellipse cx="50" cy="62" rx="38" ry="32" fill="#E1BEE7" />
                <ellipse cx="50" cy="62" rx="30" ry="26" fill="#CE93D8" />
                <ellipse cx="50" cy="62" rx="22" ry="20" fill="#BA68C8" />
                <ellipse cx="50" cy="62" rx="14" ry="14" fill="#AB47BC" />
                <ellipse cx="50" cy="62" rx="6" ry="8" fill="#9C27B0" />
                {/* 하이라이트 */}
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

        {rateLimitMessage && (
          <div className={styles.rateLimitBanner}>
            <span className={styles.rateLimitIcon}>⚠️</span>
            {rateLimitMessage.message} 
            <span className={styles.remainingTime}>(잔여 시간: {rateLimitMessage.remaining}초)</span>
          </div>
        )}

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
            includeTags={includeTags}
            excludeTags={excludeTags}
            onIncludeTagsChange={setIncludeTags}
            onExcludeTagsChange={setExcludeTags}
            regionStatus={regionStatus}
            onRefreshRegion={handleRefreshRegion}
          />
          <SearchResultsView
            searchResults={searchResults}
            activeRegionIds={activeRegionIds}
            selectedRegions={selectedRegions}
            showOnlyAvailable={showOnlyAvailable}
            includeTags={includeTags}
            excludeTags={excludeTags}
            loading={loading}
            hasSearched={hasSearched}
          />
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