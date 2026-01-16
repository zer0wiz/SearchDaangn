import styles from './Sidebar.module.css';

export default function Sidebar({ selectedRegions, activeRegionIds, onToggle, onRemove }) {
    if (!selectedRegions || selectedRegions.length === 0) {
        return (
            <aside className={styles.sidebar}>
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
            <div className={styles.header}>
                <h2>선택된 지역</h2>
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
