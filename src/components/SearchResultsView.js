'use client';

import { useState, useMemo } from 'react';
import styles from '../app/page.module.css';
import ProductCard from './ProductCard';

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

export default function SearchResultsView({
  searchResults,
  activeRegionIds,
  selectedRegions,
  includeTags,
  excludeTags,
  statusFilters = ['ongoing', 'reserved', 'sold'],
  loading,
  hasSearched,
  excludedItems = [],
  onExclude,
}) {
  const [viewSize, setViewSize] = useState('medium'); // 보기 크기: small, medium, large
  const [sortBy, setSortBy] = useState('none'); // 정렬: none, priceAsc, priceDesc, updatedAt
  const [groupBy, setGroupBy] = useState('none'); // 구분: none, location
  const [excludeOption, setExcludeOption] = useState('hide'); // 제외 옵션: hide(미노출), all(전체), only(제외만)

  // 제외 링크 Set (빠른 조회용)
  const excludedLinks = useMemo(() => new Set(excludedItems.map(item => item.link)), [excludedItems]);

  // Filter results based on checked checkboxes and word filters
  const visibleItems = useMemo(() => {
    return searchResults.filter((item) => {
      const isExcluded = excludedLinks.has(item.link);

      // 제외 옵션에 따른 필터링
      if (excludeOption === 'hide' && isExcluded) return false;
      if (excludeOption === 'only' && !isExcluded) return false;
      
      // 'all'일 경우 모두 표시 (단, 제외된 항목은 시각적으로 구분됨)

      // If originalRegion is missing for some reason, show it (fallback)
      if (!item.originalRegion) return true;
      // 타입 불일치 방지를 위해 문자열로 변환하여 비교
      const regionMatch = activeRegionIds.map(String).includes(String(item.originalRegion.id));
      
      // 상태 필터 (항상 적용)
      const itemStatusKey = STATUS_MAP[item.status] || 'ongoing';
      if (!statusFilters.includes(itemStatusKey)) {
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
  }, [searchResults, activeRegionIds, includeTags, excludeTags, statusFilters, excludedLinks, excludeOption]);

  // 정렬 적용
  const sortedItems = useMemo(() => {
    return [...visibleItems].sort((a, b) => {
      if (sortBy === 'priceAsc') {
        return (a.priceRaw || 0) - (b.priceRaw || 0);
      } else if (sortBy === 'priceDesc') {
        return (b.priceRaw || 0) - (a.priceRaw || 0);
      } else if (sortBy === 'updatedAt') {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
      }
      return 0;
    });
  }, [visibleItems, sortBy]);

  // 그룹화 적용 (activeRegionIds에 포함된 지역만, 0건이어도 그룹 표시)
  const groupedItems = useMemo(() => {
    if (groupBy !== 'location') return null;
    // activeRegionIds에 포함된 지역만 그룹화 (체크된 지역) - 타입 불일치 방지
    const activeIdsStr = activeRegionIds.map(String);
    const activeRegions = selectedRegions.filter(region => activeIdsStr.includes(String(region.id)));
    return activeRegions.map(region => {
      const items = sortedItems.filter(item => String(item.originalRegion?.id) === String(region.id));
      return { region, items };
    });
  }, [groupBy, selectedRegions, activeRegionIds, sortedItems]);

  const gridClassName = `${styles.grid} ${styles[`grid${viewSize.charAt(0).toUpperCase() + viewSize.slice(1)}`]}`;

  return (
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
        <label className={styles.viewSizeLabel}>
          제외 :
          <select
            className={styles.viewSizeSelect}
            value={excludeOption}
            onChange={(e) => setExcludeOption(e.target.value)}
          >
            <option value="hide">제외항목 미노출</option>
            <option value="all">전체보기</option>
            <option value="only">제외항목만 노출</option>
          </select>
        </label>
        <span className={styles.resultCount}>
          {visibleItems.length}건
          {excludedItems.length > 0 && (
            <span style={{ fontSize: '0.8em', marginLeft: '8px', color: '#ef4444' }}>
              (제외 {excludedItems.length}건)
            </span>
          )}
        </span>
      </div>

      {loading && <div className={styles.loading}>당근마켓에서 열심히 찾는 중... 🧅</div>}

      {!loading && hasSearched && visibleItems.length === 0 && (
        <div className={styles.noResults}>
          {searchResults.length > 0
            ? '선택된 조건의 결과가 없습니다.'
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
            <div className={gridClassName}>
              {items.map((item, idx) => (
                <ProductCard 
                  key={`${item.id}-${idx}`} 
                  item={item} 
                  size={viewSize}
                  isExcluded={excludedLinks.has(item.link)}
                  onExclude={onExclude}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className={gridClassName}>
          {sortedItems.map((item, idx) => (
            <ProductCard 
              key={`${item.id}-${idx}`} 
              item={item} 
              size={viewSize}
              isExcluded={excludedLinks.has(item.link)}
              onExclude={onExclude}
            />
          ))}
        </div>
      )}
    </div>
  );
}
