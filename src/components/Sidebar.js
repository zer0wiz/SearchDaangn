import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Loader2,
    RefreshCw,
    ChevronRight,
    MoreVertical,
    AlertCircle,
    X,
    HelpCircle,
    Square,
    Play,
    Clock
} from 'lucide-react';
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

// 시간 경과에 따른 색상 스타일 계산 함수 (0분: 초록, 20분+: 빨강)
const getCompletionTimeStyle = (date) => {
    if (!date) return {};
    const now = new Date();
    const d = new Date(date);
    const diffMs = now - d;
    const diffHour = diffMs / (1000 * 60 * 60); // 시간 단위로 계산

    // Hue: 120 (Green) to 0 (Red) over 48 hours (2 days)
    // 120 / 48 = 2.5 (1시간마다 2.5도씩 감소)
    const hue = Math.max(0, 120 - (diffHour * 2.5));
    // Saturation 80%, Lightness 40% for a vibrant but readable color
    const color = `hsl(${hue}, 80%, 40%)`;
    const backgroundColor = `hsla(${hue}, 80%, 40%, 0.1)`;

    return { color, backgroundColor };
};

// 로딩 스피너 컴포넌트
const LoadingSpinner = () => (
    <Loader2 className={styles.spinner} size={16} />
);

// 리프레쉬 아이콘 컴포넌트
const RefreshIcon = () => (
    <RefreshCw size={14} />
);

// 접기/펼치기 화살표 아이콘
const ArrowIcon = ({ expanded }) => (
    <ChevronRight
        className={`${styles.arrowIcon} ${expanded ? styles.arrowExpanded : ''}`}
        size={12}
    />
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
    minPrice = '',
    onMinPriceChange,
    maxPrice = '',
    onMaxPriceChange,
    statusFilters = ['ongoing'],
    onStatusFiltersChange,
    regionStatus = {},
    delayStatus = { regionId: null, remaining: 0 },
    onRefreshRegion,
    onRefreshRegions,
    onStopRegionSearch,
    isOpen = false,
    onClose,
    pinnedItems = [],
    excludedItems = [],
    onRemovePin,
    onRemoveExclude,
    onSearchRegion
}) {
    const [showIncludeInput, setShowIncludeInput] = useState(false);
    const [showExcludeInput, setShowExcludeInput] = useState(false);
    const [includeInputValue, setIncludeInputValue] = useState('');
    const [excludeInputValue, setExcludeInputValue] = useState('');
    const [isComposing, setIsComposing] = useState(false); // 한글 조합 중 여부
    const [openMenuId, setOpenMenuId] = useState(null); // 열린 옵션 메뉴의 region id
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 }); // 메뉴 위치
    const [expandedGroups, setExpandedGroups] = useState({}); // 그룹 펼침 상태
    const [expandedPinExclude, setExpandedPinExclude] = useState({}); // 고정/제외 펼침 상태
    const menuRef = useRef(null);
    const [, setTimeUpdate] = useState(0);

    // 지역별 제외 아이템 수 계산
    const getExcludedCount = (regionId) => {
        const regionIdStr = String(regionId);
        return excludedItems.filter(item => String(item.regionId) === regionIdStr).length;
    };

    // 지역별 제외 아이템 목록
    const getExcludedItems = (regionId) => {
        const regionIdStr = String(regionId);
        return excludedItems.filter(item => String(item.regionId) === regionIdStr);
    };

    // 제외 섹션 토글
    const toggleExclude = (regionId) => {
        setExpandedPinExclude(prev => ({
            ...prev,
            [regionId]: !prev[regionId]
        }));
    };

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

    // 지역 이름으로 검색
    const handleSearchRegion = (regionId) => {
        const region = selectedRegions.find(r => r.id === regionId);
        if (region && onSearchRegion) {
            const regionName = region.name3 || region.name2 || region.name1;
            onSearchRegion(regionName);
        }
        setOpenMenuId(null);
    };
    // 선택된 지역들의 전체 건수 계산
    const { totalApiCount, totalFilteredCount } = useMemo(() => {
        return selectedRegions.reduce((acc, region) => {
            acc.totalApiCount += (regionApiCounts[region.id] || 0);
            acc.totalFilteredCount += (regionFilteredCounts[region.id] || 0);
            return acc;
        }, { totalApiCount: 0, totalFilteredCount: 0 });
    }, [selectedRegions, regionApiCounts, regionFilteredCounts]);

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
            <>
                {/* 가격 조건 */}
                <div className={styles.conditionItem}>
                    <div className={styles.conditionHeader}>
                        <span className={styles.conditionLabel}>가격 조건 (원)</span>
                    </div>
                    <div className={styles.priceRangeWrapper}>
                        <input
                            type="text"
                            className={styles.priceRangeInput}
                            placeholder="최저가격"
                            value={minPrice}
                            onChange={(e) => onMinPriceChange && onMinPriceChange(e.target.value)}
                        />
                        <span className={styles.priceSeparator}>~</span>
                        <input
                            type="text"
                            className={styles.priceRangeInput}
                            placeholder="최대가격"
                            value={maxPrice}
                            onChange={(e) => onMaxPriceChange && onMaxPriceChange(e.target.value)}
                        />
                    </div>
                    {(minPrice || maxPrice) && (
                        <div className={styles.priceRangeHint}>
                            {(() => {
                                const min = parseInt(minPrice.toString().replace(/,/g, ''), 10);
                                const max = parseInt(maxPrice.toString().replace(/,/g, ''), 10);
                                if (!isNaN(min) && !isNaN(max)) return `${min.toLocaleString()}원 ~ ${max.toLocaleString()}원`;
                                if (!isNaN(min)) return `${min.toLocaleString()}원 이상`;
                                if (!isNaN(max)) return `${max.toLocaleString()}원 이하`;
                                return '';
                            })()}
                        </div>
                    )}
                </div>

                {/* 상태 필터 */}
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
            </>
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
                        <AlertCircle className={styles.warningIcon} size={14} />
                        전체검색이 필요합니다.
                    </span>
                )}
            </div>
        </div>
    );

    // 검색결과 필터링 섹션은 렌더링 시 직접 구성

    // 사이드바 클래스 (모바일 열림 상태 포함)
    const sidebarClassName = `${styles.sidebar} ${isOpen ? styles.open : ''}`;

    if (!selectedRegions || selectedRegions.length === 0) {
        return (
            <>
                {/* 모바일 오버레이 */}
                <div
                    className={`${styles.sidebarOverlay} ${isOpen ? styles.visible : ''}`}
                    onClick={onClose}
                />
                <aside className={sidebarClassName}>
                    {/* 모바일 닫기 버튼 */}
                    <button className={styles.mobileCloseBtn} onClick={onClose}>
                        <X size={20} />
                    </button>
                    {searchConditionSection}
                    <div className={styles.searchConditionSection}>
                        <div className={styles.filterHeader}>
                            <h2>검색결과 필터링</h2>
                            <button className={styles.resetBtn} onClick={onResetFilter}>
                                초기화
                            </button>
                        </div>

                        <div className={styles.conditionItem}>
                            <div className={styles.conditionHeader}>
                                <div className={styles.labelWithTooltip}>
                                    <span className={styles.conditionLabel}>포함된 단어</span>
                                    <div className={styles.tooltipWrapper}>
                                        <HelpCircle className={styles.tooltipIcon} size={14} />
                                        <div className={styles.tooltipText}>
                                            제외할 단어가 포함되어 있더라도, 포함된 단어가 있으면 결과에 표시됩니다. (포함된 단어 우선순위)
                                        </div>
                                    </div>
                                </div>
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
            </>
        );
    }

    // 단일 지역 아이템 렌더링
    const renderRegionItem = (region, isChild = false) => {
        const status = regionStatus[region.id];
        const isPending = status?.status === 'pending';
        const isLoading = status?.status === 'loading';
        const isCompleted = status?.status === 'completed';
        const excludedCount = getExcludedCount(region.id);
        const hasExcluded = excludedCount > 0;
        const isExpanded = expandedPinExclude[region.id];
        const excluded = getExcludedItems(region.id);

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
                        {(isPending || delayStatus.regionId === region.id) && (
                            <div className={styles.searchWithStop}>
                                <button
                                    className={styles.searchPendingBtn}
                                    onClick={() => onRefreshRegion(region.id)}
                                    title={delayStatus.regionId === region.id ? "지연 대기 중" : "이 지역 검색"}
                                    disabled={delayStatus.regionId === region.id}
                                >
                                    <Play size={10} fill="currentColor" style={{ marginRight: '4px' }} />
                                    {delayStatus.regionId === region.id ? `${delayStatus.remaining}s` : '검색'}
                                </button>
                                {delayStatus.regionId === region.id && (
                                    <button
                                        className={styles.stopRegionBtnSimple}
                                        onClick={() => onStopRegionSearch && onStopRegionSearch(region.id)}
                                        title="대기 중단"
                                    >
                                        <Square size={10} fill="currentColor" />
                                    </button>
                                )}
                            </div>
                        )}
                        {isLoading && (
                            <div className={styles.loadingWithStop}>
                                <span className={styles.statusLoading}>
                                    <LoadingSpinner />
                                </span>
                                <button
                                    className={styles.stopRegionBtn}
                                    onClick={() => onStopRegionSearch && onStopRegionSearch(region.id)}
                                    title="검색 중단 및 이 지역 건너뛰기"
                                >
                                    <Square size={10} fill="currentColor" />
                                </button>
                            </div>
                        )}
                        {isCompleted && status.completedAt && (
                            <div className={styles.statusCompletedWrapper}>
                                <span
                                    className={styles.statusCompleted}
                                    style={getCompletionTimeStyle(status.completedAt)}
                                >
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
                        <MoreVertical size={16} />
                    </button>
                </div>
                {/* 제외 정보 */}
                {hasExcluded && (
                    <div className={styles.pinnedExcludedSection}>
                        <button
                            className={styles.pinnedExcludedToggle}
                            onClick={() => toggleExclude(region.id)}
                        >
                            <span className={styles.pinnedExcludedInfo}>
                                <span className={styles.excludedInfo}>제외 : {excludedCount}건</span>
                            </span>
                            <ArrowIcon expanded={isExpanded} />
                        </button>
                        {isExpanded && (
                            <div className={styles.pinnedExcludedList}>
                                <div className={styles.excludedList}>
                                    {excluded.map((item, idx) => (
                                        <div key={idx} className={styles.excludedItem}>
                                            <span className={styles.excludedItemTitle}>{item.title}</span>
                                            <button
                                                className={styles.excludedItemRemove}
                                                onClick={() => onRemoveExclude && onRemoveExclude(item.link)}
                                                title="제외 취소"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
                                {name1} {name2}
                            </span>
                            <span className={styles.regionCount}>{regions.length}</span>
                            {(stats.totalApiCount > 0 || stats.totalFilteredCount > 0) && (
                                <span className={styles.count}>{stats.totalFilteredCount} </span>
                            )}
                        </label>
                        <div className={styles.statusArea}>
                            {(stats.hasPending && !stats.hasLoading && !regions.some(r => r.id === delayStatus.regionId)) && (
                                <button
                                    className={styles.searchPendingBtn}
                                    onClick={() => {
                                        // 해당 그룹의 대기 상태 지역만 검색
                                        const pendingInGroup = regions.filter(r => regionStatus[r.id]?.status === 'pending');
                                        if (pendingInGroup.length > 0 && onRefreshRegions) {
                                            onRefreshRegions(pendingInGroup.map(r => r.id));
                                        }
                                    }}
                                    title={`대기 중인 지역 검색`}
                                >
                                    <Play size={10} fill="currentColor" style={{ marginRight: '4px' }} />
                                    미검색 ({regions.filter(r => regionStatus[r.id]?.status === 'pending').length})
                                </button>
                            )}
                            {regions.some(r => r.id === delayStatus.regionId) && (
                                <div className={styles.searchWithStop}>
                                    <button
                                        className={styles.searchPendingBtn}
                                        title="그룹 검색 지연 중"
                                        disabled
                                    >
                                        <Play size={10} fill="currentColor" style={{ marginRight: '4px' }} />
                                        {delayStatus.remaining}s
                                    </button>
                                    <button
                                        className={styles.stopRegionBtnSimple}
                                        onClick={() => {
                                            if (onStopRegionSearch) onStopRegionSearch(delayStatus.regionId);
                                        }}
                                        title="대기 중단"
                                    >
                                        <Square size={10} fill="currentColor" />
                                    </button>
                                </div>
                            )}
                            {stats.hasLoading && (
                                <div className={styles.loadingWithStop}>
                                    <span className={styles.statusLoading}>
                                        <LoadingSpinner />
                                    </span>
                                    <button
                                        className={styles.stopRegionBtn}
                                        onClick={() => {
                                            // 해당 그룹에서 로딩 중인 모든 지역 중지
                                            const loadingRegions = regions.filter(r => regionStatus[r.id]?.status === 'loading');
                                            loadingRegions.forEach(r => onStopRegionSearch && onStopRegionSearch(r.id));
                                        }}
                                        title="이 그룹의 로딩 중인 지역 검색 중단"
                                    >
                                        <Square size={10} fill="currentColor" />
                                    </button>
                                </div>
                            )}
                            {stats.allCompleted && stats.oldestCompletedAt && (
                                <div className={styles.statusCompletedWrapper}>
                                    <span
                                        className={styles.statusCompleted}
                                        style={getCompletionTimeStyle(stats.oldestCompletedAt)}
                                    >
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
                            <MoreVertical size={16} />
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
        <>
            {/* 모바일 오버레이 */}
            <div
                className={`${styles.sidebarOverlay} ${isOpen ? styles.visible : ''}`}
                onClick={onClose}
            />
            <aside className={sidebarClassName}>
                {/* 모바일 닫기 버튼 */}
                <button className={styles.mobileCloseBtn} onClick={onClose}>
                    <X size={20} />
                </button>
                {searchConditionSection}
                <div className={styles.searchConditionSection}>
                    <div className={styles.filterHeader}>
                        <h2>검색결과 필터링</h2>
                        <button className={styles.resetBtn} onClick={onResetFilter}>
                            초기화
                        </button>
                    </div>

                    {/* 포함된 단어 */}
                    <div className={styles.conditionItem}>
                        <div className={styles.conditionHeader}>
                            <div className={styles.labelWithTooltip}>
                                <span className={styles.conditionLabel}>포함된 단어</span>
                                <div className={styles.tooltipWrapper}>
                                    <HelpCircle className={styles.tooltipIcon} size={14} />
                                    <div className={styles.tooltipText}>
                                        제외할 단어가 포함되어 있더라도, 포함된 단어가 있으면 결과에 표시됩니다. (포함된 단어 우선순위)
                                    </div>
                                </div>
                            </div>
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
                            {selectedRegions.length > 0 && (
                                <span className={styles.totalCount}>
                                    {selectedRegions.length}개 지역 ({totalFilteredCount} / {totalApiCount}건)
                                </span>
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
                            onClick={() => handleSearchRegion(openMenuId)}
                        >
                            검색
                        </button>
                        <button
                            className={styles.optionMenuItem}
                            onClick={() => handleDeleteRegion(openMenuId)}
                        >
                            삭제
                        </button>
                    </div>
                )}
            </aside>
        </>
    );
}
