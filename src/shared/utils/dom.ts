/**
 * 요소가 화면에 실제로 보이는지 확인하는 유틸리티 함수
 * - display: none (조상 포함)
 * - visibility: hidden
 * - opacity: 0
 * - 너비/높이가 0인 경우
 * - 조상 요소의 overflow: hidden/auto/scroll에 의해 완전히 가려진 경우
 */
export function isElementVisible(el: HTMLElement): boolean {
  if (!el) return false;

  // 1. 기본적인 CSS 속성 체크
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  // 2. 물리적 크기 체크
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  // 3. offsetParent 체크 (display: none인 경우 null 반환 - 가장 빠른 체크 중 하나)
  if (el.offsetParent === null && style.position !== 'fixed') {
    return false;
  }

  // 4. 조상 요소들에 의한 가려짐(Clipping) 체크
  let parent = el.parentElement;
  while (parent && parent !== document.body) {
    const parentStyle = window.getComputedStyle(parent);
    const overflow = parentStyle.overflow + parentStyle.overflowX + parentStyle.overflowY;

    if (overflow.includes('hidden') || overflow.includes('auto') || overflow.includes('scroll')) {
      const parentRect = parent.getBoundingClientRect();

      // 요소가 부모의 경계 밖으로 완전히 나갔는지 확인
      const isClipped =
        rect.bottom <= parentRect.top ||
        rect.top >= parentRect.bottom ||
        rect.right <= parentRect.left ||
        rect.left >= parentRect.right;

      if (isClipped) return false;
    }

    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return false;
    }

    parent = parent.parentElement;
  }

  // 5. 뷰포트(Viewport) 영역 내 존재 여부 확인
  const isOutsideViewport =
    rect.bottom <= 0 ||
    rect.top >= window.innerHeight ||
    rect.right <= 0 ||
    rect.left >= window.innerWidth;

  if (isOutsideViewport) return false;

  return true;
}
