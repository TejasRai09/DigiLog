import { createPortal } from 'react-dom';

/** Renders a dialog on document.body so it stacks above the sticky navbar. */
export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
