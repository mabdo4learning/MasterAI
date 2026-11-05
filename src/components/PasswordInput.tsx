import { useState, type KeyboardEvent } from 'react';
import Icon from './Icon';

type Props = {
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder: string;
  minLength?: number;
};

/** Password field with a show/hide toggle and a Caps Lock warning. */
export default function PasswordInput({ value, onChange, autoComplete, placeholder, minLength }: Props) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  return (
    <>
      <div className="input-wrap">
        <Icon name="lock" size={18} />
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onKeyUp={onKey}
        />
        <button
          type="button"
          className="input-action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {capsLock && <span className="field-hint">Caps Lock is on</span>}
    </>
  );
}
