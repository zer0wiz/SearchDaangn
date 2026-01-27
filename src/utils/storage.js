// localStorage 기반 검색 상태 저장 유틸리티 (30일 만료)

const STORAGE_KEY = 'daangn_search_state';
const EXPIRY_DAYS = 30;

/**
 * 만료 시간 계산 (30일 후)
 */
const getExpiryTime = () => {
  const now = new Date();
  now.setDate(now.getDate() + EXPIRY_DAYS);
  return now.getTime();
};

/**
 * 검색 상태 저장
 * @param {Object} state - 저장할 상태 객체
 */
export const saveSearchState = (state) => {
  try {
    const dataToSave = {
      ...state,
      _expiry: getExpiryTime(),
      _savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Failed to save search state:', e);
  }
};

/**
 * 검색 상태 조회
 * @returns {Object|null} 저장된 상태 또는 null (만료 시)
 */
export const getSearchState = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);
    
    // 만료 체크
    if (data._expiry && Date.now() > data._expiry) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // 메타 데이터 제거 후 반환
    const { _expiry, _savedAt, ...state } = data;
    return state;
  } catch (e) {
    console.error('Failed to get search state:', e);
    return null;
  }
};

/**
 * 검색 상태 삭제
 */
export const clearSearchState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear search state:', e);
  }
};

/**
 * 특정 필드만 업데이트
 * @param {Object} updates - 업데이트할 필드들
 */
export const updateSearchState = (updates) => {
  const current = getSearchState() || {};
  saveSearchState({ ...current, ...updates });
};

// 고정/제외 아이템 관리
const EXCLUDED_KEY = 'daangn_excluded_items';

/**
 * 제외된 아이템 저장
 * @param {Array} items - 제외 아이템 배열 [{ link, title, regionId, regionName }]
 */
export const saveExcludedItems = (items) => {
  try {
    const dataToSave = {
      items,
      _expiry: getExpiryTime(),
      _savedAt: Date.now(),
    };
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Failed to save excluded items:', e);
  }
};

/**
 * 제외된 아이템 조회
 * @returns {Array} 제외 아이템 배열
 */
export const getExcludedItems = () => {
  try {
    const stored = localStorage.getItem(EXCLUDED_KEY);
    if (!stored) return [];

    const data = JSON.parse(stored);
    
    if (data._expiry && Date.now() > data._expiry) {
      localStorage.removeItem(EXCLUDED_KEY);
      return [];
    }

    return data.items || [];
  } catch (e) {
    console.error('Failed to get excluded items:', e);
    return [];
  }
};
