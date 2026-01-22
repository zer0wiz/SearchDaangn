import { useState, useMemo } from 'react';
import axios from 'axios';
import styles from './RegionPopup.module.css';

export default function RegionPopup({ isOpen, onClose, onSave, initialSelected = [] }) {
    const [keyword, setKeyword] = useState('');
    const [searchedLocations, setSearchedLocations] = useState([]);
    const [selected, setSelected] = useState(initialSelected);
    const [loading, setLoading] = useState(false);

    // Group locations by name1 (e.g., "서울특별시", "경기도")
    const groupedLocations = useMemo(() => {
        return searchedLocations.reduce((acc, loc) => {
            const groupName = loc.name1 || '기타';
            if (!acc[groupName]) {
                acc[groupName] = [];
            }
            acc[groupName].push(loc);
            return acc;
        }, {});
    }, [searchedLocations]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!keyword.trim()) return;

        setLoading(true);
        try {
            const res = await axios.get(`/api/locations?keyword=${encodeURIComponent(keyword)}`);
            setSearchedLocations(res.data.locations || []);
        } catch (err) {
            console.error(err);
            alert('지역 검색 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (region) => {
        setSelected((prev) => {
            const exists = prev.find((r) => r.id === region.id);
            if (exists) {
                return prev.filter((r) => r.id !== region.id);
            } else {
                return [...prev, region];
            }
        });
    };

    const handleSelectAll = () => {
        setSelected((prev) => {
            const newSelected = [...prev];
            searchedLocations.forEach((loc) => {
                if (!newSelected.find((s) => s.id === loc.id)) {
                    newSelected.push(loc);
                }
            });
            return newSelected;
        });
    };

    const handleSave = () => {
        // onSave가 async일 수 있지만, 모달은 바로 닫고 검색은 백그라운드에서 진행
        // 검색 진행 상태는 사이드바의 regionStatus로 확인 가능
        onSave(selected);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2>지역 추가</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.body}>
                    <form onSubmit={handleSearch} className={styles.searchForm}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="동 이름 검색 (예: 삼성동)"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                        />
                        <button type="submit" className={styles.searchBtn} disabled={loading}>
                            {loading ? '검색중...' : '검색'}
                        </button>
                    </form>

                    {/* Search Results Section */}
                    <div className={styles.resultsArea}>
                        <div className={styles.resultsHeader}>
                            <h3 className={styles.groupTitle} style={{ marginBottom: 0 }}>검색 결과</h3>
                            {searchedLocations.length > 0 && (
                                <button type="button" className={styles.selectAllBtn} onClick={handleSelectAll}>
                                    전체 선택
                                </button>
                            )}
                        </div>

                        {Object.keys(groupedLocations).length === 0 && !loading && (
                            <div className={styles.emptyState}>검색 결과가 없습니다.</div>
                        )}

                        {Object.entries(groupedLocations).map(([groupName, regions]) => (
                            <div key={groupName} className={styles.group}>
                                <h4 className={styles.groupTitle} style={{ fontSize: '0.9rem', color: '#ff6f0f' }}>{groupName}</h4>
                                <div className={styles.grid}>
                                    {regions.map((region) => {
                                        const isSelected = selected.some(r => r.id === region.id);
                                        return (
                                            <button
                                                key={region.id}
                                                type="button"
                                                className={`${styles.regionBtn} ${isSelected ? styles.selected : ''}`}
                                                onClick={() => toggleSelect(region)}
                                            >
                                                {region.name2} {region.name3}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    <hr className={styles.divider} />

                    {/* Selected Regions Section */}
                    <div className={styles.section}>
                        <h3 className={styles.groupTitle}>선택된 지역</h3>
                        {selected.length === 0 ? (
                            <div className={styles.emptySelection}>선택된 지역이 없습니다.</div>
                        ) : (
                            <div className={styles.grid}>
                                {selected.map((region) => (
                                    <button
                                        key={`selected-${region.id}`}
                                        type="button"
                                        className={`${styles.regionBtn} ${styles.selected}`}
                                        onClick={() => toggleSelect(region)}
                                    >
                                        {region.name2} {region.name3} <span className={styles.xIcon}>×</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.status}>
                        {selected.length}개 지역 선택됨
                    </div>
                    <button className={styles.saveBtn} onClick={handleSave}>
                        저장
                    </button>
                </div>
            </div>
        </div>
    );
}
