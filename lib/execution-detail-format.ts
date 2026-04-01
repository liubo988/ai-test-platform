export function formatExecutionMoment(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function summarizeExecutionTextList(values: string[], limit = 2): string {
  const items = values.map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return '';
  if (items.length <= limit) return items.join(' / ');
  return `${items.slice(0, limit).join(' / ')} 等 ${items.length} 项`;
}
