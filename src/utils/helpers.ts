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
