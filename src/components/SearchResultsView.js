'use client';

import { useState, useMemo } from 'react';
import styles from '../app/page.module.css';
import ProductCard from './ProductCard';

export default function SearchResultsView({
  searchResults,
  activeRegionIds,
  selectedRegions,
  showOnlyAvailable,
  includeTags,
  excludeTags,
  loading,
  hasSearched,
}) {
  const [viewSize, setViewSize] = useState('medium'); // 보기 크기: small, medium, large
  const [sortBy, setSortBy] = useState('none'); // 정렬: none, priceAsc, priceDesc, updatedAt
  const [groupBy, setGroupBy] = useState('none'); // 구분: none, location

  // Filter results based on checked checkboxes and availability
  const visibleItems = useMemo(() => {
    return searchResults.filter((item) => {
      // If originalRegion is missing for some reason, show it (fallback)
      if (!item.originalRegion) return true;
      const regionMatch = activeRegionIds.includes(item.originalRegion.id);
      // 거래 가능만 보기 필터 (판매중이 아닌 상품 제외)
      if (showOnlyAvailable && item.status && item.status !== '판매중' && item.status !== 'ON_SALE') {
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
  }, [searchResults, activeRegionIds, showOnlyAvailable, includeTags, excludeTags]);

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

  // 그룹화 적용
  const groupedItems = useMemo(() => {
    if (groupBy !== 'location') return null;
    return selectedRegions.reduce((acc, region) => {
      const items = sortedItems.filter(item => item.originalRegion?.id === region.id);
      if (items.length > 0) {
        acc.push({ region, items });
      }
      return acc;
    }, []);
  }, [groupBy, selectedRegions, sortedItems]);

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
        <span className={styles.resultCount}>
          {visibleItems.length}건
        </span>
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
            <div className={gridClassName}>
              {items.map((item, idx) => (
                <ProductCard key={`${item.id}-${idx}`} item={item} size={viewSize} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className={gridClassName}>
          {sortedItems.map((item, idx) => (
            <ProductCard key={`${item.id}-${idx}`} item={item} size={viewSize} />
          ))}
        </div>
      )}
    </div>
  );
}
