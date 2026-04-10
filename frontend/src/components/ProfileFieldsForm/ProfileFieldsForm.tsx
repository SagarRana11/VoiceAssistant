import { useState } from 'react';
import type { CollectFieldSpec } from '../../hooks/useAgentConversation';
import styles from './ProfileFieldsForm.module.css';

interface Props {
  fields: CollectFieldSpec[];
  onSubmit: (values: Record<string, string>) => void;
  isSubmitting?: boolean;
}

export function ProfileFieldsForm({ fields, onSubmit, isSubmitting }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.field] = '';
    }
    return initial;
  });

  const allFilled = fields.every(f => values[f.field]?.trim() !== '');

  const handleChange = (field: string, value: string) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allFilled && !isSubmitting) onSubmit(values);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {fields.map((spec) => (
        <div key={spec.field} className={styles.fieldGroup}>
          <label className={styles.label}>{spec.question}</label>

          {spec.inputType === 'select' && spec.options ? (
            <div className={styles.optionsGrid}>
              {spec.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`${styles.optionBtn} ${values[spec.field] === opt.value ? styles.optionSelected : ''}`}
                  onClick={() => handleChange(spec.field, opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : spec.inputType === 'number' ? (
            <div className={styles.numberInput}>
              <input
                type="number"
                className={styles.input}
                placeholder={spec.unit ? `e.g. 170` : ''}
                value={values[spec.field]}
                onChange={(e) => handleChange(spec.field, e.target.value)}
              />
              {spec.unit && <span className={styles.unit}>{spec.unit}</span>}
            </div>
          ) : (
            <input
              type="text"
              className={styles.input}
              placeholder="Type here or leave empty for none"
              value={values[spec.field]}
              onChange={(e) => handleChange(spec.field, e.target.value)}
            />
          )}
        </div>
      ))}

      <button
        type="submit"
        className={styles.submitBtn}
        disabled={!allFilled || isSubmitting}
      >
        {isSubmitting ? 'Creating your plan...' : 'Generate Plan'}
      </button>
    </form>
  );
}
