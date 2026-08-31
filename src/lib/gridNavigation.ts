export function moveVerticalSelection(
  sectionLengths: readonly number[],
  selectedIndex: number,
  columnsPerRow: number,
  direction: 'up' | 'down',
): number {
  if (sectionLengths.length === 0) return selectedIndex;

  const itemCount = sectionLengths.reduce((total, length) => total + length, 0);
  const currentIndex = Math.min(selectedIndex, itemCount - 1);
  let sectionIndex = 0;
  let sectionStart = 0;

  while (currentIndex >= sectionStart + sectionLengths[sectionIndex]) {
    sectionStart += sectionLengths[sectionIndex];
    sectionIndex += 1;
  }

  const sectionLength = sectionLengths[sectionIndex];
  const localIndex = currentIndex - sectionStart;
  const column = localIndex % columnsPerRow;
  const rowStart = localIndex - column;

  if (direction === 'down') {
    const nextRowStart = rowStart + columnsPerRow;
    if (nextRowStart < sectionLength) {
      return sectionStart + Math.min(nextRowStart + column, sectionLength - 1);
    }

    if (sectionIndex === sectionLengths.length - 1) return currentIndex;
    return sectionStart + sectionLength
      + Math.min(column, sectionLengths[sectionIndex + 1] - 1);
  }

  if (rowStart > 0) {
    return sectionStart + rowStart - columnsPerRow + column;
  }

  if (sectionIndex === 0) return currentIndex;
  const previousSectionLength = sectionLengths[sectionIndex - 1];
  const previousRowStart = Math.floor((previousSectionLength - 1) / columnsPerRow)
    * columnsPerRow;
  return sectionStart - previousSectionLength
    + Math.min(previousRowStart + column, previousSectionLength - 1);
}
