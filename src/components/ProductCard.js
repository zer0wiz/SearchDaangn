import styles from './ProductCard.module.css';

export default function ProductCard({ item, size = 'medium' }) {
    const sizeClass = styles[`card${size.charAt(0).toUpperCase() + size.slice(1)}`];
    return (
        <a href={item.link} target="_blank" rel="noopener noreferrer" className={`${styles.card} ${sizeClass}`}>
            <div className={styles.imageWrapper}>
                <img src={item.img} alt={item.title} className={styles.image} loading="lazy" />
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
