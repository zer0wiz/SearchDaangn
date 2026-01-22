'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import styles from '../../page.module.css';
import Sidebar from '@/components/Sidebar';
import RegionPopup from '@/components/RegionPopup';
import SearchResultsView from '@/components/SearchResultsView';
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
  const [lastSearchedOnlyAvailable, setLastSearchedOnlyAvailable] = useState(true);
  const [needsResearch, setNeedsResearch] = useState(false);
  const [regionStatus, setRegionStatus] = useState({});
  const [includeTags, setIncludeTags] = useState([]); // 포함할 단어
  const [excludeTags, setExcludeTags] = useState([]); // 제외할 단어
  const [statusFilters, setStatusFilters] = useState(['ongoing']); // 상태 필터 (초기: 거래가능만)
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
        setStatusFilters(['ongoing']);
      } else {
        // 이전에 전체검색했으면 바로 활성화
        setNeedsResearch(false);
        setStatusFilters(['ongoing', 'reserved', 'sold']);
      }
    }
  };

  const searchSingleRegion = async (region, searchKeyword, onlyOnSale = showOnlyAvailable) => {
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

    // 검색 시 현재 거래가능만 보기 상태 저장
    setLastSearchedOnlyAvailable(showOnlyAvailable);
    setNeedsResearch(false);
    
    // 거래가능만 보기 해제 상태로 검색하면 상태 필터 전체 활성화
    if (!showOnlyAvailable) {
      setStatusFilters(['ongoing', 'reserved', 'sold']);
    }

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

  const handleSaveRegions = async (newRegions) => {
    // 새로 추가된 지역 찾기
    const existingIds = selectedRegions.map(r => r.id);
    const addedRegions = newRegions.filter(r => !existingIds.includes(r.id));

    setSelectedRegions(newRegions);
    saveCookie(newRegions);

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
    setActiveRegionIds((prev) => prev.filter((rid) => String(rid) !== idStr));
    setSearchResults((prev) => prev.filter((item) => String(item.originalRegion?.id) !== idStr));
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
