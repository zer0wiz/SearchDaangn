import { useState, useEffect } from 'react';
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

export default function Sidebar({ 
    selectedRegions, 
    activeRegionIds, 
    onToggle, 
    onRemove,
    showOnlyAvailable,
    onToggleAvailable,
    onResetFilter,
    regionCounts = {},
    includeTags = [],
    excludeTags = [],
    onIncludeTagsChange,
    onExcludeTagsChange,
    regionStatus = {},
    onRefreshRegion
}) {
    const [showIncludeInput, setShowIncludeInput] = useState(false);
    const [showExcludeInput, setShowExcludeInput] = useState(false);
    const [includeInputValue, setIncludeInputValue] = useState('');
    const [excludeInputValue, setExcludeInputValue] = useState('');
    const [, setTimeUpdate] = useState(0);

    // 30초마다 상대 시간 업데이트
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeUpdate(prev => prev + 1);
        }, 30000);
        return () => clearInterval(interval);
    }, []);
    // 선택된 지역들의 전체 건수 계산
    const totalCount = selectedRegions?.reduce((sum, region) => {
        return sum + (regionCounts[region.id] || 0);
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
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddIncludeTag();
        }
    };

    const handleExcludeKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddExcludeTag();
        }
    };

    const FilterSection = () => (
        <div className={styles.filterSection}>
            <div className={styles.filterHeader}>
                <h2>필터</h2>
                <button className={styles.resetBtn} onClick={onResetFilter}>
                    초기화
                </button>
            </div>
            <label className={styles.filterLabel}>
                <input
                    type="checkbox"
                    checked={showOnlyAvailable}
                    onChange={onToggleAvailable}
                    className={styles.filterCheckbox}
                />
                <span>거래 가능만 보기</span>
            </label>
        </div>
    );

    const SearchConditionSection = () => (
        <div className={styles.searchConditionSection}>
            <div className={styles.filterHeader}>
                <h2>검색조건</h2>
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
        </div>
    );

    if (!selectedRegions || selectedRegions.length === 0) {
        return (
            <aside className={styles.sidebar}>
                <FilterSection />
                <SearchConditionSection />
                <div className={styles.header}>
                    <h2>선택된 지역</h2>
                </div>
                <div className={styles.empty}>
                    지역을 추가해보세요.
                </div>
            </aside>
        );
    }

    return (
        <aside className={styles.sidebar}>
            <FilterSection />
            <SearchConditionSection />
            <div className={styles.header}>
                <h2>선택된 지역</h2>
                {totalCount > 0 && (
                    <span className={styles.totalCount}>{totalCount}건</span>
                )}
            </div>
            <ul className={styles.list}>
                {selectedRegions.map((region) => {
                    const status = regionStatus[region.id];
                    const isPending = status?.status === 'pending';
                    const isLoading = status?.status === 'loading';
                    const isCompleted = status?.status === 'completed';
                    
                    return (
                        <li key={region.id} className={styles.item}>
                            <div className={styles.itemContent}>
                                <label className={styles.label}>
                                <input
                                    type="checkbox"
                                    checked={activeRegionIds.includes(region.id)}
                                    onChange={() => onToggle(region.id)}
                                    className={styles.checkbox}
                                />
                                    <span className={styles.text}>
                                        {region.name2} {region.name3}
                                    </span>
                                    {regionCounts[region.id] > 0 && (
                                        <span className={styles.count}>{regionCounts[region.id]}</span>
                                    )}
                                </label>
                                <div className={styles.statusArea}>
                                    {/* 상태 표시 */}
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
                                    onClick={() => onRemove(region.id)}
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
                })}
            </ul>
        </aside>
    );
}
