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

export default function ProductCard({ item, size = 'medium' }) {
    const sizeClass = styles[`card${size.charAt(0).toUpperCase() + size.slice(1)}`];
    const statusInfo = STATUS_INFO[item.status];
    
    return (
        <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${styles.card} ${sizeClass}`}>
            <div className={styles.imageWrapper}>
                <img src={item.img} alt={item.title} className={styles.image} loading="lazy" />
                {statusInfo && (
                    <div className={`${styles.statusBadge} ${styles[statusInfo.className]}`}>
                        {statusInfo.label}
                    </div>
                )}
            </div>
            <div className={styles.content}>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.price}>{item.price}</p>
                <div className={styles.footer}>
                    <span className={styles.region}>{item.regionName}</span>
                    {item.timeAgo && <span className={styles.timeAgo}>{item.timeAgo}</span>}
                </div>
            </div>
        </a>
    );
}
