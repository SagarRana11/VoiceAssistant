import { useState, useRef, useEffect } from 'react';
import { RoleId } from '../../types';
import { ROLE_LIST, ROLES } from '../../constants/roles';
import styles from './RoleSelector.module.css';

interface Props {
  currentRole: RoleId;
  onChange: (role: RoleId) => void;
  disabled?: boolean;
}

export function RoleSelector({ currentRole, onChange, disabled = false }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const role = ROLES[currentRole];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (id: RoleId) => {
    if (id !== currentRole) onChange(id);
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{ '--role-color': role.color } as React.CSSProperties}
      >
        <span className={styles.icon}>{role.icon}</span>
        <span className={styles.name}>{role.name}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {ROLE_LIST.map((r) => (
            <button
              key={r.id}
              className={`${styles.option} ${r.id === currentRole ? styles.optionActive : ''}`}
              onClick={() => handleSelect(r.id)}
              role="option"
              aria-selected={r.id === currentRole}
              style={{ '--role-color': r.color } as React.CSSProperties}
            >
              <span className={styles.optionIcon}>{r.icon}</span>
              <div className={styles.optionText}>
                <span className={styles.optionName}>{r.name}</span>
                <span className={styles.optionDesc}>{r.description}</span>
              </div>
              {r.id === currentRole && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
