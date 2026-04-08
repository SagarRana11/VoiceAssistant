import styles from './SoundWave.module.css';

interface Props {
  isActive: boolean;
  color?: string;
  barCount?: number;
}

export function SoundWave({ isActive, color = '#0071e3', barCount = 12 }: Props) {
  return (
    <div
      className={`${styles.container} ${isActive ? styles.active : styles.inactive}`}
      aria-hidden="true"
    >
      {Array.from({ length: barCount }, (_, i) => (
        <div
          key={i}
          className={styles.bar}
          style={{
            '--bar-index': i,
            '--bar-color': color,
            '--bar-delay': `${(i * 0.08) % 0.6}s`,
            '--bar-duration': `${0.4 + (i % 4) * 0.1}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
