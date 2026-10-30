/**
 * Una fila con desplazamiento horizontal que también responde a la rueda del
 * ratón: el giro vertical la mueve de lado. Cuando la fila llega a un extremo,
 * la rueda vuelve a desplazar la página, para no atrapar al usuario.
 */
export function wheelX(node: HTMLElement) {
  const onWheel = (e: WheelEvent) => {
    // Los trackpads ya mandan desplazamiento horizontal; no se toca.
    if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const max = node.scrollWidth - node.clientWidth;
    if (max <= 0) return;
    const atStart = node.scrollLeft <= 0 && e.deltaY < 0;
    const atEnd = node.scrollLeft >= max - 1 && e.deltaY > 0;
    if (atStart || atEnd) return;
    e.preventDefault();
    node.scrollLeft += e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
  };

  node.addEventListener("wheel", onWheel, { passive: false });
  return {
    destroy() {
      node.removeEventListener("wheel", onWheel);
    },
  };
}
