export default function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
}) {
  const id = `field-${name}`;

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={error ? 'input input-error' : 'input'}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : null}
    </label>
  );
}
