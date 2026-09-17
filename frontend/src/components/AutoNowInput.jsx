import { useEffect, useRef } from 'react';
import { autoNowOffsetMinutes, nowForInputType } from '../utils/formNow';

/**
 * Date / time / datetime-local input that fills with the current local
 * date/time when empty (including after Reset).
 */
export default function AutoNowInput({
  type,
  name,
  value,
  onChange,
  skipAuto = false,
  offsetMinutes,
  ...rest
}) {
  const minutes = offsetMinutes != null ? offsetMinutes : autoNowOffsetMinutes(name);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (skipAuto) return;
    if (value) return;
    if (type !== 'date' && type !== 'time' && type !== 'datetime-local') return;
    const next = nowForInputType(type, minutes);
    if (!next || typeof onChangeRef.current !== 'function') return;
    onChangeRef.current({ target: { name: name || '', value: next, type } });
  }, [skipAuto, value, type, name, minutes]);

  return <input type={type} name={name} value={value} onChange={onChange} {...rest} />;
}
