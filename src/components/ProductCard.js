import styles from './ProductCard.module.css';

export default function ProductCard({ item }) {
    return (
        <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.card}>
            <div className={styles.imageWrapper}>
                <img src={item.img} alt={item.title} className={styles.image} loading="lazy" />
            </div>
            <div className={styles.content}>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.price}>{item.price}</p>
                <div className={styles.footer}>
                    <span className={styles.region}>{item.regionName}</span>
                    <span className={styles.origin}>(검색: {item.originalRegion?.name3})</span>
                </div>
            </div>
        </a>
    );
}
