import { Copy, X as CloseIcon } from 'lucide-react';
import styles from './ProductCard.module.css';

// 상태값 매핑
const STATUS_INFO = {
    'Reserved': { label: '예약중', className: 'statusReserved' },
    'reserved': { label: '예약중', className: 'statusReserved' },
    'RESERVED': { label: '예약중', className: 'statusReserved' },
    '예약중': { label: '예약중', className: 'statusReserved' },
    'Completed': { label: '판매완료', className: 'statusSold' },
    'completed': { label: '판매완료', className: 'statusSold' },
    'COMPLETED': { label: '판매완료', className: 'statusSold' },
    'Soldout': { label: '판매완료', className: 'statusSold' },
    'soldout': { label: '판매완료', className: 'statusSold' },
    'SOLDOUT': { label: '판매완료', className: 'statusSold' },
    '거래완료': { label: '판매완료', className: 'statusSold' },
    '판매완료': { label: '판매완료', className: 'statusSold' },
};

export default function ProductCard({
    item,
    size = 'medium',
    isExcluded = false,
    onExclude
}) {
    const sizeClass = styles[`card${size.charAt(0).toUpperCase() + size.slice(1)}`];
    const statusInfo = STATUS_INFO[item.status];
    const hasActions = !!onExclude;

    const handleExcludeClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onExclude) onExclude(item);
    };

    const handleCopyImage = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            // 이미지를 canvas에 그려서 PNG로 변환
            const img = new Image();
            img.crossOrigin = 'anonymous';

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = item.img;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            alert('이미지가 클립보드에 복사되었습니다.');
        } catch (err) {
            console.error('이미지 복사 실패:', err);
            alert('이미지 복사에 실패했습니다.');
        }
    };

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.card} ${sizeClass} ${isExcluded ? styles.excluded : ''}`}
        >
            <div className={styles.imageWrapper}>
                <img src={item.img} alt={item.title} className={styles.image} loading="lazy" />
                {statusInfo && (
                    <div className={`${styles.statusBadge} ${styles[statusInfo.className]}`}>
                        {statusInfo.label}
                    </div>
                )}
                {/* 호버 시 복사 버튼 (오른쪽 하단) */}
                <button
                    className={styles.copyBtn}
                    onClick={handleCopyImage}
                    title="이미지 복사"
                >
                    <Copy size={14} />
                </button>
            </div>
            <div className={styles.content}>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.price}>{item.price}</p>
                <div className={styles.footer}>
                    <span className={styles.region}>{item.regionName}</span>
                    {item.timeAgo && <span className={styles.timeAgo}>{item.timeAgo}</span>}
                </div>
            </div>
            {/* 호버 시 제외 버튼 (오른쪽 상단, CSS로 표시/숨김 제어) */}
            {hasActions && (
                <button
                    className={`${styles.excludeBtn} ${isExcluded ? styles.excludeBtnActive : ''}`}
                    onClick={handleExcludeClick}
                    title={isExcluded ? '제외 취소' : '제외'}
                >
                    <CloseIcon size={16} />
                </button>
            )}
        </a>
    );
}
