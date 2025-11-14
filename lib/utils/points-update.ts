/**
 * 触发全局积分更新事件
 * 用于通知所有监听组件（如导航栏）更新积分显示
 */
export function triggerPointsUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pointsChanged'))
  }
}

/**
 * 监听积分更新事件
 * @param callback 积分更新时的回调函数
 * @returns 清理函数
 */
export function onPointsUpdate(callback: () => void) {
  if (typeof window !== 'undefined') {
    window.addEventListener('pointsChanged', callback)
    return () => window.removeEventListener('pointsChanged', callback)
  }
  return () => {}
}
