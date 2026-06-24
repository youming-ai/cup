/**
 * 将字符串转为 URL 友好的 kebab-case 格式
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 移除非字母、非数字、非空白、非横杠字符
    .replace(/[\s_]+/g, '-')   // 空白或下划线替换为单个横杠
    .replace(/-+/g, '-');      // 连续横杠替换为单个
}

/**
 * 转换普通文本为匹配键值
 */
export function getKebabCase(text: string): string {
  const brokenCamel = text
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2');
  return slugify(brokenCamel);
}
