import { useState, useEffect, useRef, useMemo } from 'react';
import styles from './Sidebar.module.css';

// 상대 시간 포맷 함수
const formatRelativeTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
        return '방금전';
    } else if (diffMin < 60) {
        return `${diffMin}분전`;
    } else if (diffHour < 24) {
        return `${diffHour}시간전`;
    } else {
        return `${diffDay}일전`;
    }
};

// 로딩 스피너 컴포넌트
const LoadingSpinner = () => (
    <svg className={styles.spinner} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
    </svg>
);

// 리프레쉬 아이콘 컴포넌트
const RefreshIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3019 3 18.1885 4.77814 19.7545 7.42909" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M21 3V8H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// 접기/펼치기 화살표 아이콘
const ArrowIcon = ({ expanded }) => (
    <svg 
        className={`${styles.arrowIcon} ${expanded ? styles.arrowExpanded : ''}`} 
        width="12" 
        height="12" 
        viewBox="0 0 12 12" 
        fill="currentColor"
    >
        <path d="M4 2L8 6L4 10" />
    </svg>
);

export default function Sidebar({ 
    selectedRegions, 
    activeRegionIds, 
    onToggle, 
    onRemove,
    showOnlyAvailable,
    onToggleAvailable,
    needsResearch = false,
    onResetFilter,
    regionApiCounts = {},
    regionFilteredCounts = {},
    includeTags = [],
    excludeTags = [],
    onIncludeTagsChange,
    onExcludeTagsChange,
    statusFilters = ['ongoing'],
    onStatusFiltersChange,
    regionStatus = {},
    onRefreshRegion,
    onRefreshRegions
}) {
    const [showIncludeInput, setShowIncludeInput] = useState(false);
    const [showExcludeInput, setShowExcludeInput] = useState(false);
    const [includeInputValue, setIncludeInputValue] = useState('');
    const [excludeInputValue, setExcludeInputValue] = useState('');
    const [isComposing, setIsComposing] = useState(false); // 한글 조합 중 여부
    const [openMenuId, setOpenMenuId] = useState(null); // 열린 옵션 메뉴의 region id
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 }); // 메뉴 위치
    const [expandedGroups, setExpandedGroups] = useState({}); // 그룹 펼침 상태
    const menuRef = useRef(null);
    const [, setTimeUpdate] = useState(0);

    // 지역을 name1 + name2 기준으로 그룹화
    const groupedRegions = useMemo(() => {
        if (!selectedRegions || selectedRegions.length === 0) return [];
        
        const groups = {};
        selectedRegions.forEach(region => {
            const groupKey = `${region.name1} ${region.name2}`;
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    key: groupKey,
                    name1: region.name1,
                    name2: region.name2,
                    regions: []
                };
            }
            groups[groupKey].regions.push(region);
        });
        
        return Object.values(groups);
    }, [selectedRegions]);

    // 그룹 토글 (펼치기/접기)
    const toggleGroup = (groupKey) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupKey]: !prev[groupKey]
        }));
    };

    // 그룹 체크박스 토글 (하위 모든 지역 선택/해제)
    // 타입 불일치 방지를 위해 문자열로 변환하여 비교
    const activeRegionIdsStr = activeRegionIds.map(String);
    
    const toggleGroupCheck = (regions) => {
        const regionIds = regions.map(r => r.id);
        const allChecked = regionIds.every(id => activeRegionIdsStr.includes(String(id)));
        
        if (allChecked) {
            // 모두 체크 해제
            regionIds.forEach(id => onToggle(id));
        } else {
            // 모두 체크
            regionIds.forEach(id => {
                if (!activeRegionIdsStr.includes(String(id))) {
                    onToggle(id);
                }
            });
        }
    };

    // 그룹 새로고침 (하위 모든 지역 순차 검색)
    const refreshGroup = (regions) => {
        const regionIds = regions.map(r => r.id);
        if (onRefreshRegions) {
            onRefreshRegions(regionIds);
        }
    };

    // 그룹 통계 계산
    const getGroupStats = (regions) => {
        const totalApiCount = regions.reduce((sum, r) => sum + (regionApiCounts[r.id] || 0), 0);
        const totalFilteredCount = regions.reduce((sum, r) => sum + (regionFilteredCounts[r.id] || 0), 0);
        
        // 가장 오래된 completedAt 찾기
        let oldestCompletedAt = null;
        let hasLoading = false;
        let hasPending = false;
        let allCompleted = true;
        
        regions.forEach(r => {
            const status = regionStatus[r.id];
            if (status?.status === 'loading') hasLoading = true;
            if (status?.status === 'pending') hasPending = true;
            if (status?.status !== 'completed') allCompleted = false;
            
            if (status?.completedAt) {
                const completedDate = new Date(status.completedAt);
                if (!oldestCompletedAt || completedDate < oldestCompletedAt) {
                    oldestCompletedAt = completedDate;
                }
            }
        });
        
        return { totalApiCount, totalFilteredCount, oldestCompletedAt, hasLoading, hasPending, allCompleted };
    };

    // 30초마다 상대 시간 업데이트
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeUpdate(prev => prev + 1);
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // 메뉴 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        if (openMenuId !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openMenuId]);

    const handleOptionClick = (e, regionId) => {
        if (openMenuId === regionId) {
            setOpenMenuId(null);
        } else {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({
                top: rect.bottom + 4,
                left: rect.right - 100 // 메뉴 너비(100px)만큼 왼쪽으로
            });
            setOpenMenuId(regionId);
        }
    };

    const handleDeleteRegion = (regionId) => {
        onRemove(regionId);
        setOpenMenuId(null);
    };
    // 선택된 지역들의 전체 건수 계산
    const totalApiCount = selectedRegions?.reduce((sum, region) => {
        return sum + (regionApiCounts[region.id] || 0);
    }, 0) || 0;
    
    const totalFilteredCount = selectedRegions?.reduce((sum, region) => {
        return sum + (regionFilteredCounts[region.id] || 0);
    }, 0) || 0;

    const handleAddIncludeTag = () => {
        const value = includeInputValue.trim();
        if (value && !includeTags.includes(value)) {
            onIncludeTagsChange([...includeTags, value]);
        }
        setIncludeInputValue('');
    };

    const handleAddExcludeTag = () => {
        const value = excludeInputValue.trim();
        if (value && !excludeTags.includes(value)) {
            onExcludeTagsChange([...excludeTags, value]);
        }
        setExcludeInputValue('');
    };

    const handleRemoveIncludeTag = (tag) => {
        onIncludeTagsChange(includeTags.filter(t => t !== tag));
    };

    const handleRemoveExcludeTag = (tag) => {
        onExcludeTagsChange(excludeTags.filter(t => t !== tag));
    };

    const handleIncludeKeyDown = (e) => {
        if (e.key === 'Enter' && !isComposing) {
            e.preventDefault();
            handleAddIncludeTag();
        }
    };

    const handleExcludeKeyDown = (e) => {
        if (e.key === 'Enter' && !isComposing) {
            e.preventDefault();
            handleAddExcludeTag();
        }
    };

    // 상태 필터 토글
    const toggleStatusFilter = (status) => {
        // 비활성화 상태면 토글 불가
        if (isStatusFilterDisabled) return;
        
        if (statusFilters.includes(status)) {
            // 최소 1개는 선택되어 있어야 함
            if (statusFilters.length > 1) {
                onStatusFiltersChange(statusFilters.filter(s => s !== status));
            }
        } else {
            onStatusFiltersChange([...statusFilters, status]);
        }
    };

    // 상태 필터 비활성화 여부 계산
    // 1. 거래가능만 보기 체크됨 -> 비활성화
    // 2. 거래가능만 보기 해제됨 + 전체검색 필요 -> 비활성화
    const isStatusFilterDisabled = showOnlyAvailable || needsResearch;

    // 상태 필터 체크박스 렌더링 (항상 표시)
    const renderStatusFilters = () => {
        const statusOptions = [
            { key: 'ongoing', label: '거래가능' },
            { key: 'reserved', label: '예약중' },
            { key: 'sold', label: '거래완료' },
        ];

        // 체크 상태 결정
        const getCheckedState = (key) => {
            if (showOnlyAvailable || needsResearch) {
                // 거래가능만 보기 체크됨 또는 전체검색 필요시: 거래가능만 체크
                return key === 'ongoing';
            }
            return statusFilters.includes(key);
        };

        return (
            <div className={styles.conditionItem}>
                <div className={styles.conditionHeader}>
                    <span className={styles.conditionLabel}>상태 필터</span>
                </div>
                <div className={styles.statusFilterList}>
                    {statusOptions.map(({ key, label }) => (
                        <label 
                            key={key} 
                            className={`${styles.statusFilterLabel} ${isStatusFilterDisabled ? styles.disabled : ''}`}
                        >
                            <input
                                type="checkbox"
                                checked={getCheckedState(key)}
                                onChange={() => toggleStatusFilter(key)}
                                className={styles.statusFilterCheckbox}
                                disabled={isStatusFilterDisabled}
                            />
                            <span>{label}</span>
                        </label>
                    ))}
                </div>
            </div>
        );
    };

    // 검색조건 섹션 (API 조건 - 거래 가능만 보기)
    const searchConditionSection = (
        <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
                <h2>검색조건</h2>
            </div>
            <div className={styles.filterLabelWrapper}>
                <label className={styles.filterLabel}>
                    <input
                        type="checkbox"
                        checked={showOnlyAvailable}
                        onChange={onToggleAvailable}
                        className={styles.filterCheckbox}
                    />
                    <span>거래 가능만 보기</span>
                </label>
                {needsResearch && (
                    <span className={styles.researchWarning}>
                        <svg className={styles.warningIcon} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        전체검색이 필요합니다.
                    </span>
                )}
            </div>
        </div>
    );

    // 검색결과 필터링 섹션은 렌더링 시 직접 구성

    if (!selectedRegions || selectedRegions.length === 0) {
        return (
            <aside className={styles.sidebar}>
                {searchConditionSection}
                <div className={styles.searchConditionSection}>
                    <div className={styles.filterHeader}>
                        <h2>검색결과 필터링</h2>
                        <button className={styles.resetBtn} onClick={onResetFilter}>
                            초기화
                        </button>
                    </div>
                    
                    {/* 포함할 단어 */}
                    <div className={styles.conditionItem}>
                        <div className={styles.conditionHeader}>
                            <span className={styles.conditionLabel}>포함할 단어</span>
                            <button 
                                className={styles.addBtn}
                                onClick={() => setShowIncludeInput(!showIncludeInput)}
                            >
                                +
                            </button>
                        </div>
                        {showIncludeInput && (
                            <div className={styles.tagInputWrapper}>
                                <input
                                    type="text"
                                    className={styles.tagInput}
                                    placeholder="단어 입력 후 Enter"
                                    value={includeInputValue}
                                    onChange={(e) => setIncludeInputValue(e.target.value)}
                                    onKeyDown={handleIncludeKeyDown}
                                    onCompositionStart={() => setIsComposing(true)}
                                    onCompositionEnd={() => setIsComposing(false)}
                                    autoFocus
                                />
                            </div>
                        )}
                        {includeTags.length > 0 && (
                            <div className={styles.tagList}>
                                {includeTags.map((tag, idx) => (
                                    <span key={idx} className={styles.tag}>
                                        {tag}
                                        <button 
                                            className={styles.tagRemoveBtn}
                                            onClick={() => handleRemoveIncludeTag(tag)}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 제외할 단어 */}
                    <div className={styles.conditionItem}>
                        <div className={styles.conditionHeader}>
                            <span className={styles.conditionLabel}>제외할 단어</span>
                            <button 
                                className={styles.addBtn}
                                onClick={() => setShowExcludeInput(!showExcludeInput)}
                            >
                                +
                            </button>
                        </div>
                        {showExcludeInput && (
                            <div className={styles.tagInputWrapper}>
                                <input
                                    type="text"
                                    className={styles.tagInput}
                                    placeholder="단어 입력 후 Enter"
                                    value={excludeInputValue}
                                    onChange={(e) => setExcludeInputValue(e.target.value)}
                                    onKeyDown={handleExcludeKeyDown}
                                    onCompositionStart={() => setIsComposing(true)}
                                    onCompositionEnd={() => setIsComposing(false)}
                                    autoFocus
                                />
                            </div>
                        )}
                        {excludeTags.length > 0 && (
                            <div className={styles.tagList}>
                                {excludeTags.map((tag, idx) => (
                                    <span key={idx} className={`${styles.tag} ${styles.excludeTag}`}>
                                        {tag}
                                        <button 
                                            className={styles.tagRemoveBtn}
                                            onClick={() => handleRemoveExcludeTag(tag)}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 상태 필터 */}
                    {renderStatusFilters()}

                    {/* 선택된 지역 */}
                    <div className={styles.conditionItem}>
                        <div className={styles.conditionHeader}>
                            <span className={styles.conditionLabel}>선택된 지역</span>
                        </div>
                        <div className={styles.empty}>
                            지역을 추가해보세요.
                        </div>
                    </div>
                </div>
            </aside>
        );
    }

    // 단일 지역 아이템 렌더링
    const renderRegionItem = (region, isChild = false) => {
        const status = regionStatus[region.id];
        const isPending = status?.status === 'pending';
        const isLoading = status?.status === 'loading';
        const isCompleted = status?.status === 'completed';
        
        return (
            <li key={region.id} className={`${styles.item} ${isChild ? styles.childItem : ''}`}>
                <div className={styles.itemContent}>
                    <label className={styles.label}>
                        <input
                            type="checkbox"
                            checked={activeRegionIdsStr.includes(String(region.id))}
                            onChange={() => onToggle(region.id)}
                            className={styles.checkbox}
                        />
                        <span className={styles.text}>
                            {region.name2} {region.name3}
                        </span>
                        {(regionApiCounts[region.id] > 0 || regionFilteredCounts[region.id] > 0) && (
                            <span className={styles.count}>{regionFilteredCounts[region.id] || 0}</span>
                        )}
                    </label>
                    <div className={styles.statusArea}>
                        {isPending && (
                            <span className={styles.statusPending}>대기</span>
                        )}
                        {isLoading && (
                            <span className={styles.statusLoading}>
                                <LoadingSpinner />
                            </span>
                        )}
                        {isCompleted && status.completedAt && (
                            <div className={styles.statusCompletedWrapper}>
                                <span className={styles.statusCompleted}>
                                    완료 : {formatRelativeTime(status.completedAt)}
                                </span>
                                <button
                                    className={styles.refreshBtn}
                                    onClick={() => onRefreshRegion(region.id)}
                                    disabled={isLoading}
                                    aria-label="Refresh region"
                                    title="다시 검색"
                                >
                                    <RefreshIcon />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.separator}></div>
                <div className={styles.buttonWrapper}>
                    <button
                        className={styles.optionBtn}
                        onClick={(e) => handleOptionClick(e, region.id)}
                        aria-label="Options"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <circle cx="8" cy="3" r="1.5" />
                            <circle cx="8" cy="8" r="1.5" />
                            <circle cx="8" cy="13" r="1.5" />
                        </svg>
                    </button>
                </div>
            </li>
        );
    };

    // 그룹 폴더 렌더링
    const renderGroup = (group) => {
        const { key, name1, name2, regions } = group;
        const isExpanded = expandedGroups[key];
        const stats = getGroupStats(regions);
        const firstRegion = regions[0];
        const remainingCount = regions.length - 1;
        const allChecked = regions.every(r => activeRegionIdsStr.includes(String(r.id)));
        const someChecked = regions.some(r => activeRegionIdsStr.includes(String(r.id)));
        
        return (
            <div key={key} className={styles.groupContainer}>
                {/* 폴더 헤더 */}
                <div className={styles.folderRow}>
                    <button 
                        className={styles.expandBtn}
                        onClick={() => toggleGroup(key)}
                        aria-label={isExpanded ? "접기" : "펼치기"}
                    >
                        <ArrowIcon expanded={isExpanded} />
                    </button>
                    <div className={styles.folderContent}>
                        <label className={styles.label}>
                            <input
                                type="checkbox"
                                checked={allChecked}
                                ref={el => {
                                    if (el) el.indeterminate = someChecked && !allChecked;
                                }}
                                onChange={() => toggleGroupCheck(regions)}
                                className={styles.checkbox}
                            />
                            <span className={styles.folderText}>
                                {name1} {name2} {firstRegion.name3} 외 {remainingCount}건
                            </span>
                            {(stats.totalApiCount > 0 || stats.totalFilteredCount > 0) && (
                                <span className={styles.count}>{stats.totalFilteredCount}</span>
                            )}
                        </label>
                        <div className={styles.statusArea}>
                            {stats.hasPending && !stats.hasLoading && (
                                <span className={styles.statusPending}>대기</span>
                            )}
                            {stats.hasLoading && (
                                <span className={styles.statusLoading}>
                                    <LoadingSpinner />
                                </span>
                            )}
                            {stats.allCompleted && stats.oldestCompletedAt && (
                                <div className={styles.statusCompletedWrapper}>
                                    <span className={styles.statusCompleted}>
                                        완료 : {formatRelativeTime(stats.oldestCompletedAt)}
                                    </span>
                                    <button
                                        className={styles.refreshBtn}
                                        onClick={() => refreshGroup(regions)}
                                        disabled={stats.hasLoading}
                                        aria-label="Refresh group"
                                        title="그룹 전체 다시 검색"
                                    >
                                        <RefreshIcon />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.separator}></div>
                    <div className={styles.buttonWrapper}>
                        <button
                            className={styles.optionBtn}
                            onClick={(e) => handleOptionClick(e, `group-${key}`)}
                            aria-label="Options"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="8" cy="3" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="8" cy="13" r="1.5" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                {/* 하위 지역 리스트 */}
                {isExpanded && (
                    <ul className={styles.childList}>
                        {regions.map(region => renderRegionItem(region, true))}
                    </ul>
                )}
            </div>
        );
    };

    return (
        <aside className={styles.sidebar}>
            {searchConditionSection}
            <div className={styles.searchConditionSection}>
                <div className={styles.filterHeader}>
                    <h2>검색결과 필터링</h2>
                    <button className={styles.resetBtn} onClick={onResetFilter}>
                        초기화
                    </button>
                </div>
                
                {/* 포함할 단어 */}
                <div className={styles.conditionItem}>
                    <div className={styles.conditionHeader}>
                        <span className={styles.conditionLabel}>포함할 단어</span>
                        <button 
                            className={styles.addBtn}
                            onClick={() => setShowIncludeInput(!showIncludeInput)}
                        >
                            +
                        </button>
                    </div>
                    {showIncludeInput && (
                        <div className={styles.tagInputWrapper}>
                            <input
                                type="text"
                                className={styles.tagInput}
                                placeholder="단어 입력 후 Enter"
                                value={includeInputValue}
                                onChange={(e) => setIncludeInputValue(e.target.value)}
                                onKeyDown={handleIncludeKeyDown}
                                onCompositionStart={() => setIsComposing(true)}
                                onCompositionEnd={() => setIsComposing(false)}
                                autoFocus
                            />
                        </div>
                    )}
                    {includeTags.length > 0 && (
                        <div className={styles.tagList}>
                            {includeTags.map((tag, idx) => (
                                <span key={idx} className={styles.tag}>
                                    {tag}
                                    <button 
                                        className={styles.tagRemoveBtn}
                                        onClick={() => handleRemoveIncludeTag(tag)}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* 제외할 단어 */}
                <div className={styles.conditionItem}>
                    <div className={styles.conditionHeader}>
                        <span className={styles.conditionLabel}>제외할 단어</span>
                        <button 
                            className={styles.addBtn}
                            onClick={() => setShowExcludeInput(!showExcludeInput)}
                        >
                            +
                        </button>
                    </div>
                    {showExcludeInput && (
                        <div className={styles.tagInputWrapper}>
                            <input
                                type="text"
                                className={styles.tagInput}
                                placeholder="단어 입력 후 Enter"
                                value={excludeInputValue}
                                onChange={(e) => setExcludeInputValue(e.target.value)}
                                onKeyDown={handleExcludeKeyDown}
                                onCompositionStart={() => setIsComposing(true)}
                                onCompositionEnd={() => setIsComposing(false)}
                                autoFocus
                            />
                        </div>
                    )}
                    {excludeTags.length > 0 && (
                        <div className={styles.tagList}>
                            {excludeTags.map((tag, idx) => (
                                <span key={idx} className={`${styles.tag} ${styles.excludeTag}`}>
                                    {tag}
                                    <button 
                                        className={styles.tagRemoveBtn}
                                        onClick={() => handleRemoveExcludeTag(tag)}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* 상태 필터 */}
                {renderStatusFilters()}

                {/* 선택된 지역 */}
                <div className={styles.conditionItem}>
                    <div className={styles.conditionHeader}>
                        <span className={styles.conditionLabel}>선택된 지역</span>
                        {(totalApiCount > 0 || totalFilteredCount > 0) && (
                            <span className={styles.totalCount}>{totalFilteredCount} / {totalApiCount}건</span>
                        )}
                    </div>
                    <ul className={styles.list}>
                        {groupedRegions.map(group => {
                            // 그룹 내 항목이 2개 이상이면 폴더로 표시
                            if (group.regions.length > 1) {
                                return renderGroup(group);
                            }
                            // 1개면 단일 항목으로 표시
                            return renderRegionItem(group.regions[0], false);
                        })}
                    </ul>
                </div>
            </div>
            {openMenuId !== null && (
                <div 
                    ref={menuRef}
                    className={styles.optionMenu}
                    style={{ top: menuPosition.top, left: menuPosition.left }}
                >
                    <button
                        className={styles.optionMenuItem}
                        onClick={() => handleDeleteRegion(openMenuId)}
                    >
                        삭제
                    </button>
                </div>
            )}
        </aside>
    );
}
