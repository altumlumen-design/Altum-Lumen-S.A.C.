function sgdFilterBandeja_(rows, priority, origin) {
  const requestedPriority = norm_(priority).replace(/_/g, ' ');
  return rows.filter(row =>
    (!requestedPriority || norm_(row.priority || 'NORMAL').replace(/_/g, ' ') === requestedPriority) &&
    (!origin || String(row.origin) === origin)
  );
}
