/** Mueve la misma instancia fuera de las capas del viaje sin volver a cargar el mapa. */
export function mapFullscreen(node: HTMLElement, enabled: boolean) {
  const anchor = document.createComment("map-position");
  node.parentNode?.insertBefore(anchor, node);
  function update(full: boolean) {
    if (full) document.body.appendChild(node);
    else if (anchor.parentNode && node.previousSibling !== anchor) anchor.parentNode.insertBefore(node, anchor.nextSibling);
  }
  update(enabled);
  return { update, destroy() { anchor.remove(); node.remove(); } };
}
