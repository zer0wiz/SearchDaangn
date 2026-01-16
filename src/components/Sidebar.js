import styles from './Sidebar.module.css';

export default function Sidebar({ 
    selectedRegions, 
    activeRegionIds, 
    onToggle, 
    onRemove,
    showOnlyAvailable,
    onToggleAvailable,
    onResetFilter,
    regionCounts = {}
}) {
    // 선택된 지역들의 전체 건수 계산
    const totalCount = selectedRegions?.reduce((sum, region) => {
        return sum + (regionCounts[region.id] || 0);
    }, 0) || 0;

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

    if (!selectedRegions || selectedRegions.length === 0) {
        return (
            <aside className={styles.sidebar}>
                <FilterSection />
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
            <div className={styles.header}>
                <h2>선택된 지역</h2>
                {totalCount > 0 && (
                    <span className={styles.totalCount}>{totalCount}건</span>
                )}
            </div>
            <ul className={styles.list}>
                {selectedRegions.map((region) => (
                    <li key={region.id} className={styles.item}>
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
                        <button
                            className={styles.removeBtn}
                            onClick={() => onRemove(region.id)}
                            aria-label="Remove region"
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
