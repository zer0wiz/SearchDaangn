'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styles from './page.module.css';
import Sidebar from '@/components/Sidebar';
import RegionPopup from '@/components/RegionPopup';
import SearchResultsView from '@/components/SearchResultsView';
import { getSelectedRegions, setSelectedRegions as saveCookie } from '@/utils/cookie';
import { saveSearchState, getSearchState, getExcludedItems, saveExcludedItems } from '@/utils/storage';

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
  const [lastSearchedOnlyAvailable, setLastSearchedOnlyAvailable] = useState(true); // 마지막 검색 시 거래가능만 보기 상태
  const [needsResearch, setNeedsResearch] = useState(false); // 전체검색 필요 여부
  const [regionStatus, setRegionStatus] = useState({}); // 지역별 상태 관리
  const [includeTags, setIncludeTags] = useState([]); // 포함할 단어
  const [excludeTags, setExcludeTags] = useState([]); // 제외할 단어
  const [statusFilters, setStatusFilters] = useState(['ongoing']); // 상태 필터 (초기: 거래가능만)
  const [searchCache, setSearchCache] = useState({}); // 검색 캐시: { [cacheKey]: { items: [], timestamp: number } }
  const [rateLimitMessage, setRateLimitMessage] = useState(null); // 제한 메시지
  const [validationMessage, setValidationMessage] = useState(null); // 유효성 검사 메시지
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // 모바일 사이드바 상태
  const [excludedItems, setExcludedItems] = useState([]); // 제외된 아이템
  const searchAbortRef = useRef(null); // 검색 중단용
  const [isSearchPaused, setIsSearchPaused] = useState(false); // 검색 일시중지 상태
  const [pendingRegions, setPendingRegions] = useState([]); // 검색 대기 중인 지역들

  // Load saved state on mount
  useEffect(() => {
    // 제외 아이템 복원 (localStorage)
    const savedExcluded = getExcludedItems();
    if (savedExcluded && savedExcluded.length > 0) {
      setExcludedItems(savedExcluded);
    }

    // 검색 상태 복원 (localStorage) - 지역 정보 포함
    const savedState = getSearchState();
    if (savedState) {
      if (savedState.keyword) setKeyword(savedState.keyword);
      if (savedState.searchResults) setSearchResults(savedState.searchResults);
      if (savedState.hasSearched !== undefined) setHasSearched(savedState.hasSearched);
      if (savedState.showOnlyAvailable !== undefined) setShowOnlyAvailable(savedState.showOnlyAvailable);
      if (savedState.lastSearchedOnlyAvailable !== undefined) setLastSearchedOnlyAvailable(savedState.lastSearchedOnlyAvailable);
      if (savedState.includeTags) setIncludeTags(savedState.includeTags);
      if (savedState.excludeTags) setExcludeTags(savedState.excludeTags);
      if (savedState.statusFilters) setStatusFilters(savedState.statusFilters);
      if (savedState.activeRegionIds) setActiveRegionIds(savedState.activeRegionIds);
      if (savedState.regionStatus) setRegionStatus(savedState.regionStatus);
      // localStorage에서 지역 정보 복원 (우선)
      if (savedState.selectedRegions && savedState.selectedRegions.length > 0) {
        setSelectedRegions(savedState.selectedRegions);
        // 쿠키도 동기화
        saveCookie(savedState.selectedRegions);
      } else {
        // localStorage에 없으면 쿠키에서 복원 (fallback)
        const savedRegions = getSelectedRegions();
        if (savedRegions && savedRegions.length > 0) {
          setSelectedRegions(savedRegions);
          if (!savedState.activeRegionIds) {
            setActiveRegionIds(savedRegions.map((r) => r.id));
          }
        }
      }
    } else {
      // localStorage에 저장된 상태가 없으면 쿠키에서 지역 정보만 복원
      const savedRegions = getSelectedRegions();
      if (savedRegions && savedRegions.length > 0) {
        setSelectedRegions(savedRegions);
        setActiveRegionIds(savedRegions.map((r) => r.id));
      }
    }
  }, []);

  // 상태 변경 시 localStorage에 저장 (검색 결과가 있을 때만)
  useEffect(() => {
    if (hasSearched) {
      saveSearchState({
        keyword,
        searchResults,
        hasSearched,
        showOnlyAvailable,
        lastSearchedOnlyAvailable,
        includeTags,
        excludeTags,
        statusFilters,
        activeRegionIds,
        regionStatus,
        selectedRegions, // 지역 정보도 localStorage에 저장
      });
    }
  }, [
    keyword,
    searchResults,
    hasSearched,
    showOnlyAvailable,
    lastSearchedOnlyAvailable,
    includeTags,
    excludeTags,
    statusFilters,
    activeRegionIds,
    regionStatus,
    selectedRegions,
  ]);

  // API 상태값을 내부 상태 키로 매핑
  const STATUS_MAP = {
    'Ongoing': 'ongoing',
    'ongoing': 'ongoing',
    'ONGOING': 'ongoing',
    '판매중': 'ongoing',
    'ON_SALE': 'ongoing',
    'Reserved': 'reserved',
    'reserved': 'reserved',
    'RESERVED': 'reserved',
    '예약중': 'reserved',
    'Completed': 'sold',
    'completed': 'sold',
    'COMPLETED': 'sold',
    'Soldout': 'sold',
    'soldout': 'sold',
    'SOLDOUT': 'sold',
    '거래완료': 'sold',
    '판매완료': 'sold',
  };

  // 지역별 API 검색 결과 건수 계산 (필터링 전)
  const regionApiCounts = searchResults.reduce((acc, item) => {
    if (item.originalRegion?.id) {
      acc[item.originalRegion.id] = (acc[item.originalRegion.id] || 0) + 1;
    }
    return acc;
  }, {});

  // 필터링된 결과 계산
  const filteredResults = searchResults.filter((item) => {
    if (!item.originalRegion) return true;
    
    // 상태 필터
    const itemStatusKey = STATUS_MAP[item.status] || 'ongoing';
    if (!statusFilters.includes(itemStatusKey)) {
      return false;
    }
    
    // 포함할 단어 필터
    if (includeTags.length > 0) {
      const title = item.title?.toLowerCase() || '';
      const content = item.content?.toLowerCase() || '';
      const searchText = title + ' ' + content;
      const hasAllInclude = includeTags.every(tag => searchText.includes(tag.toLowerCase()));
      if (!hasAllInclude) return false;
    }
    
    // 제외할 단어 필터
    if (excludeTags.length > 0) {
      const title = item.title?.toLowerCase() || '';
      const content = item.content?.toLowerCase() || '';
      const searchText = title + ' ' + content;
      const hasAnyExclude = excludeTags.some(tag => searchText.includes(tag.toLowerCase()));
      if (hasAnyExclude) return false;
    }
    
    return true;
  });

  // 지역별 필터링 건수 계산
  const regionFilteredCounts = filteredResults.reduce((acc, item) => {
    if (item.originalRegion?.id) {
      acc[item.originalRegion.id] = (acc[item.originalRegion.id] || 0) + 1;
    }
    return acc;
  }, {});

  const handleResetFilter = () => {
    // 검색결과 필터링만 초기화 (거래가능만 보기 제외)
    setIncludeTags([]);
    setExcludeTags([]);
    // 상태 필터는 거래가능만 보기 상태에 따라 초기화
    if (showOnlyAvailable) {
      setStatusFilters(['ongoing']);
    } else {
      setStatusFilters(['ongoing', 'reserved', 'sold']);
    }
  };

  // 거래가능만 보기 토글 핸들러
  const handleToggleAvailable = () => {
    const newValue = !showOnlyAvailable;
    setShowOnlyAvailable(newValue);
    
    if (newValue) {
      // 체크됨: 상태 필터를 거래가능만 체크로 변경 (활성화 상태)
      setStatusFilters(['ongoing']);
      setNeedsResearch(false);
    } else {
      // 체크 해제됨
      if (lastSearchedOnlyAvailable) {
        // 이전에 거래가능만 보기로 검색했으면 전체검색 필요
        setNeedsResearch(true);
        // 상태 필터는 거래가능만 체크된 상태로 비활성화
        setStatusFilters(['ongoing']);
      } else {
        // 이전에 전체검색했으면 바로 활성화
        setNeedsResearch(false);
        setStatusFilters(['ongoing', 'reserved', 'sold']);
      }
    }
  };

  // 단일 지역 검색 함수
  const searchSingleRegion = async (region, searchKeyword, onlyOnSale = showOnlyAvailable) => {
    const cacheKey = `${region.id}-${searchKeyword}-${onlyOnSale}`;
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
        onlyOnSale,
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
      setValidationMessage('검색어를 먼저 입력해주세요.');
      return;
    }
    const region = selectedRegions.find(r => r.id === regionId);
    if (region) {
      setValidationMessage(null);
      setRateLimitMessage(null); // 메시지 초기화
      await searchSingleRegion(region, keyword);
    }
  };

  // 여러 지역 일괄 리프레쉬 (지연 검색 적용)
  const handleRefreshRegions = async (regionIds) => {
    if (!keyword.trim()) {
      setValidationMessage('검색어를 먼저 입력해주세요.');
      return;
    }
    
    const regionsToRefresh = selectedRegions.filter(r => regionIds.includes(r.id));
    if (regionsToRefresh.length === 0) return;

    setRateLimitMessage(null); // 메시지 초기화

    // 모든 지역을 pending 상태로 설정
    const pendingStatus = {};
    regionsToRefresh.forEach(region => {
      pendingStatus[region.id] = { status: 'pending', completedAt: null };
    });
    setRegionStatus(prev => ({ ...prev, ...pendingStatus }));

    // 순차적으로 각 지역 검색 (지연 적용)
    for (let i = 0; i < regionsToRefresh.length; i++) {
      const region = regionsToRefresh[i];
      await searchSingleRegion(region, keyword);
      
      // 마지막 요청이 아니면 딜레이
      if (i < regionsToRefresh.length - 1) {
        await delay(getRandomDelay());
      }
    }
  };

  // 지연 함수
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const getRandomDelay = (min = 1500, max = 5000) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // 검색 유효성 검사
  const validateSearch = () => {
    if (!keyword.trim()) {
      setValidationMessage('검색어를 입력해주세요.');
      return false;
    }
    if (selectedRegions.length === 0) {
      setValidationMessage('선택된 지역이 없습니다. 지역을 먼저 선택해주세요.');
      setIsPopupOpen(true);
      return false;
    }
    return true;
  };

  // 검색 중지 핸들러
  const handleStopSearch = () => {
    if (searchAbortRef.current) {
      searchAbortRef.current.abort = true;
    }
    setIsSearchPaused(true);
    setLoading(false);
  };

  // 검색 재개 핸들러 (남은 지역만 검색)
  const handleResumeSearch = async () => {
    if (pendingRegions.length === 0) return;

    setIsSearchPaused(false);
    setLoading(true);
    searchAbortRef.current = { abort: false };

    // 남은 지역들 순차 검색
    for (let i = 0; i < pendingRegions.length; i++) {
      // 중지 요청 확인
      if (searchAbortRef.current?.abort) {
        // 남은 지역 저장
        setPendingRegions(pendingRegions.slice(i));
        setIsSearchPaused(true);
        setLoading(false);
        return;
      }

      const region = pendingRegions[i];
      await searchSingleRegion(region, keyword);
      
      // 마지막 요청이 아니면 딜레이
      if (i < pendingRegions.length - 1) {
        await delay(getRandomDelay(500, 1500));
      }
    }

    setPendingRegions([]);
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e && e.preventDefault();
    
    // 검색 중이면 중지
    if (loading) {
      handleStopSearch();
      return;
    }

    // 일시중지 상태에서 클릭하면 재개
    if (isSearchPaused && pendingRegions.length > 0) {
      handleResumeSearch();
      return;
    }

    if (!validateSearch()) return;

    setValidationMessage(null); // 유효성 메시지 초기화
    setRateLimitMessage(null); // 제한 메시지 초기화
    setIsSearchPaused(false);
    setPendingRegions([]);
    searchAbortRef.current = { abort: false };

    // 검색 시작 시 모든 지역을 pending 상태로 초기화
    const initialStatus = {};
    selectedRegions.forEach(region => {
      initialStatus[region.id] = { status: 'pending', completedAt: null };
    });
    setRegionStatus(initialStatus);

    setLoading(true);
    setHasSearched(true);
    setSearchResults([]); // 기존 결과 초기화

    // 검색 시 현재 거래가능만 보기 상태 저장
    setLastSearchedOnlyAvailable(showOnlyAvailable);
    setNeedsResearch(false);
    
    // 거래가능만 보기 해제 상태로 검색하면 상태 필터 전체 활성화
    if (!showOnlyAvailable) {
      setStatusFilters(['ongoing', 'reserved', 'sold']);
    }

    // 순차적으로 각 지역 검색
    for (let i = 0; i < selectedRegions.length; i++) {
      // 중지 요청 확인
      if (searchAbortRef.current?.abort) {
        // 남은 지역 저장
        setPendingRegions(selectedRegions.slice(i));
        setIsSearchPaused(true);
        setLoading(false);
        return;
      }

      const region = selectedRegions[i];
      await searchSingleRegion(region, keyword);
      
      // 마지막 요청이 아니면 딜레이
      if (i < selectedRegions.length - 1) {
        await delay(getRandomDelay(500, 1500));
      }
    }

    setPendingRegions([]);
    setLoading(false);
  };

  const handleSaveRegions = (newRegions) => {
    setSelectedRegions(newRegions);
    saveCookie(newRegions);

    // Auto-check new regions
    const newIds = newRegions.map((r) => r.id);
    setActiveRegionIds(newIds);
  };

  const handleToggleRegion = (id) => {
    // 타입 일관성을 위해 문자열로 변환하여 비교
    const idStr = String(id);
    setActiveRegionIds((prev) => {
      const prevStr = prev.map(String);
      if (prevStr.includes(idStr)) {
        return prev.filter((rid) => String(rid) !== idStr);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleRemoveRegion = (id) => {
    const idStr = String(id);
    const newRegions = selectedRegions.filter((r) => String(r.id) !== idStr);
    setSelectedRegions(newRegions);
    saveCookie(newRegions);

    // Also remove from active
    setActiveRegionIds((prev) => prev.filter((rid) => String(rid) !== idStr));

    // Remove items from results that belonged to this region
    setSearchResults((prev) => prev.filter((item) => String(item.originalRegion?.id) !== idStr));
  };

  // 제외 아이템 핸들러
  const handleExclude = (item) => {
    const itemLink = item.link;
    const isAlreadyExcluded = excludedItems.some(e => e.link === itemLink);
    
    if (isAlreadyExcluded) {
      // 이미 제외된 경우 해제
      const newExcluded = excludedItems.filter(e => e.link !== itemLink);
      setExcludedItems(newExcluded);
      saveExcludedItems(newExcluded);
    } else {
      // 제외 추가
      const newExcludedItem = {
        link: item.link,
        title: item.title,
        regionId: item.originalRegion?.id,
        regionName: item.regionName
      };
      const newExcluded = [...excludedItems, newExcludedItem];
      setExcludedItems(newExcluded);
      saveExcludedItems(newExcluded);
    }
  };

  // 제외 해제 핸들러 (사이드바에서 사용)
  const handleRemoveExclude = (link) => {
    const newExcluded = excludedItems.filter(e => e.link !== link);
    setExcludedItems(newExcluded);
    saveExcludedItems(newExcluded);
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
            <button type="submit" className={`${styles.searchBtn} ${loading ? styles.searchBtnStop : ''} ${isSearchPaused ? styles.searchBtnResume : ''}`}>
              {loading ? '중지' : isSearchPaused && pendingRegions.length > 0 ? '재개' : '검색'}
            </button>
          </form>
          <button
            className={styles.addRegionBtn}
            onClick={() => setIsPopupOpen(true)}
          >
            + 지역 추가
          </button>
        </div>

        {validationMessage && (
          <div className={styles.validationBanner}>
            <span className={styles.validationIcon}>⚠️</span>
            {validationMessage}
            <button 
              className={styles.validationClose}
              onClick={() => setValidationMessage(null)}
            >
              ✕
            </button>
          </div>
        )}

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
            onToggleAvailable={handleToggleAvailable}
            needsResearch={needsResearch}
            onResetFilter={handleResetFilter}
            regionApiCounts={regionApiCounts}
            regionFilteredCounts={regionFilteredCounts}
            includeTags={includeTags}
            excludeTags={excludeTags}
            onIncludeTagsChange={setIncludeTags}
            onExcludeTagsChange={setExcludeTags}
            statusFilters={statusFilters}
            onStatusFiltersChange={setStatusFilters}
            regionStatus={regionStatus}
            onRefreshRegion={handleRefreshRegion}
            onRefreshRegions={handleRefreshRegions}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            excludedItems={excludedItems}
            onRemoveExclude={handleRemoveExclude}
            onSearchRegion={(regionName) => {
              setKeyword(regionName);
              // 검색어 설정 후 검색 실행
              setTimeout(() => {
                const searchBtn = document.querySelector('button[type="submit"]');
                if (searchBtn) searchBtn.click();
              }, 0);
            }}
          />
          <SearchResultsView
            searchResults={searchResults}
            activeRegionIds={activeRegionIds}
            selectedRegions={selectedRegions}
            includeTags={includeTags}
            excludeTags={excludeTags}
            statusFilters={statusFilters}
            loading={loading}
            hasSearched={hasSearched}
            excludedItems={excludedItems}
            onExclude={handleExclude}
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

      {/* 모바일 메뉴 토글 버튼 */}
      <button 
        className={styles.mobileMenuBtn}
        onClick={() => setIsSidebarOpen(true)}
        aria-label="필터 메뉴 열기"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6H21M3 12H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}