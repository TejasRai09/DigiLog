/**
 * Legacy-style Report Date row: one centered label above date + datetime-local
 * (avoids separate "Date" and "Time" labels). Field names stay `date` / `time` for API.
 */
export default function ReportDateFields({
  dateValue,
  timeValue,
  onChange,
  dateName = 'date',
  timeName = 'time',
  dateRequired = false,
  timeRequired = false,
}) {
  const needsStar = dateRequired || timeRequired;

  return (
    <div className="shrink-0">
      <label className="label block text-center font-semibold text-gray-900 mb-2">
        Report Date:
        {needsStar ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
      <div className="flex flex-wrap gap-3 justify-center">
        <input
          type="date"
          name={dateName}
          value={dateValue}
          onChange={onChange}
          required={dateRequired}
          className="input min-w-[11rem]"
        />
        <input
          type="datetime-local"
          name={timeName}
          value={timeValue}
          onChange={onChange}
          required={timeRequired}
          className="input min-w-[13rem]"
        />
      </div>
    </div>
  );
}
