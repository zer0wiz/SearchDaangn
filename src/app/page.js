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
  const [viewSize, setViewSize] = useState('medium'); // 보기 크기: small, medium, large
  const [sortBy, setSortBy] = useState('none'); // 정렬: none, priceAsc, priceDesc, updatedAt
  const [groupBy, setGroupBy] = useState('none'); // 구분: none, location
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

  // Filter results based on checked checkboxes and availability
  const visibleItems = searchResults.filter((item) => {
    // If originalRegion is missing for some reason, show it (fallback)
    if (!item.originalRegion) return true;
    const regionMatch = activeRegionIds.includes(item.originalRegion.id);
    // 거래 가능만 보기 필터
    if (showOnlyAvailable && item.status && item.status !== '판매중') {
      return false;
    }
    // 포함할 단어 필터 (모든 단어가 제목 또는 내용에 포함되어야 함)
    if (includeTags.length > 0) {
      const title = item.title?.toLowerCase() || '';
      const content = item.content?.toLowerCase() || '';
      const searchText = title + ' ' + content;
      const hasAllInclude = includeTags.every(tag => searchText.includes(tag.toLowerCase()));
      if (!hasAllInclude) return false;
    }
    // 제외할 단어 필터 (하나라도 제목 또는 내용에 포함되면 제외)
    if (excludeTags.length > 0) {
      const title = item.title?.toLowerCase() || '';
      const content = item.content?.toLowerCase() || '';
      const searchText = title + ' ' + content;
      const hasAnyExclude = excludeTags.some(tag => searchText.includes(tag.toLowerCase()));
      if (hasAnyExclude) return false;
    }
    return regionMatch;
  });

  // 정렬 적용
  const sortedItems = [...visibleItems].sort((a, b) => {
    if (sortBy === 'priceAsc') {
      return (a.price || 0) - (b.price || 0);
    } else if (sortBy === 'priceDesc') {
      return (b.price || 0) - (a.price || 0);
    } else if (sortBy === 'updatedAt') {
      const dateA = new Date(a.updatedAt || a.createdAt || 0);
      const dateB = new Date(b.updatedAt || b.createdAt || 0);
      return dateB - dateA;
    }
    return 0;
  });

  // 그룹화 적용
  const groupedItems = groupBy === 'location'
    ? selectedRegions.reduce((acc, region) => {
        const items = sortedItems.filter(item => item.originalRegion?.id === region.id);
        if (items.length > 0) {
          acc.push({ region, items });
        }
        return acc;
      }, [])
    : null;

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
          <div className={styles.content}>
          <div className={styles.viewOptions}>
            <label className={styles.viewSizeLabel}>
              구분 :
              <select
                className={styles.viewSizeSelect}
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="none">구분 없음</option>
                <option value="location">위치</option>
              </select>
            </label>
            <label className={styles.viewSizeLabel}>
              정렬 :
              <select
                className={styles.viewSizeSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="none">정렬 없음</option>
                <option value="priceAsc">최저 가격</option>
                <option value="priceDesc">최고 가격</option>
                <option value="updatedAt">업데이트일자</option>
              </select>
            </label>
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

          {groupedItems ? (
            groupedItems.map(({ region, items }) => (
              <div key={region.id} className={styles.groupSection}>
                <h3 className={styles.groupTitle}>{region.name3}</h3>
                <div className={`${styles.grid} ${styles[`grid${viewSize.charAt(0).toUpperCase() + viewSize.slice(1)}`]}`}>
                  {items.map((item, idx) => (
                    <ProductCard key={`${item.id}-${idx}`} item={item} size={viewSize} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className={`${styles.grid} ${styles[`grid${viewSize.charAt(0).toUpperCase() + viewSize.slice(1)}`]}`}>
              {sortedItems.map((item, idx) => (
                <ProductCard key={`${item.id}-${idx}`} item={item} size={viewSize} />
              ))}
            </div>
          )}
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