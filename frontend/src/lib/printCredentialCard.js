/**
 * A learner's sign-in card, printed on whichever printer the computer already
 * uses: the browser's own print dialog, no PDF to download and open first.
 *
 * The card is built in a hidden frame out of DOM nodes, with textContent for every
 * value. A learner's name is therefore only ever text and never markup, and none
 * of this needs an escape function of its own.
 */

const CARD_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; }
  .card { width: 86mm; border: 1px solid #d8dee8; border-radius: 3mm; padding: 5mm; break-inside: avoid; }
  .brand { font-size: 14pt; font-weight: 700; }
  .url { font-size: 8pt; color: #4b5563; margin-top: 1mm; overflow-wrap: anywhere; }
  hr { border: 0; border-top: 1px solid #edf0f5; margin: 4mm 0; }
  .school { font-size: 10pt; font-weight: 700; }
  .line { font-size: 10pt; margin-top: 2.5mm; }
  .credential { font-size: 12pt; font-weight: 700; margin-top: 3mm; overflow-wrap: anywhere; }
  .note { font-size: 8pt; color: #6b7280; margin-top: 5mm; }
`;

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Fills `doc` with the card. Details that were not given are left out. */
export function buildCredentialCard(
  doc,
  { fullName, schoolName, grade, stream, username, password, signInUrl }
) {
  // The print header shows the page title.
  doc.title = `Login card - ${fullName}`;

  const style = doc.createElement("style");
  style.textContent = CARD_CSS;
  doc.head.appendChild(style);

  const card = element(doc, "div", "card");
  card.appendChild(element(doc, "div", "brand", "eduClub LMS"));
  if (signInUrl) card.appendChild(element(doc, "div", "url", signInUrl));
  card.appendChild(element(doc, "hr"));
  if (schoolName) card.appendChild(element(doc, "div", "school", schoolName));
  card.appendChild(element(doc, "div", "line", `Name: ${fullName}`));
  if (grade) card.appendChild(element(doc, "div", "line", `Grade: ${grade}`));
  if (stream) card.appendChild(element(doc, "div", "line", `Stream: ${stream}`));
  card.appendChild(element(doc, "div", "credential", `Username: ${username}`));
  card.appendChild(element(doc, "div", "credential", `Password: ${password}`));
  card.appendChild(
    element(
      doc,
      "div",
      "note",
      "First login will ask the learner to reset the password and complete missing profile details."
    )
  );
  doc.body.appendChild(card);
}

// Browsers differ on when print() returns, and some never say the dialog closed,
// so the frame is removed when the browser reports printing is over or, failing
// that, a good while after: taking it away sooner can cancel the print.
const CLEANUP_AFTER_MS = 2 * 60 * 1000;

export function printCredentialCard(
  credentials,
  { print = (frameWindow) => frameWindow.print() } = {}
) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const frameDocument = frame.contentDocument;
  frameDocument.open();
  frameDocument.write(
    '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
  );
  frameDocument.close();
  buildCredentialCard(frameDocument, credentials);

  const remove = () => frame.remove();
  frame.contentWindow.addEventListener("afterprint", remove);
  setTimeout(remove, CLEANUP_AFTER_MS);

  frame.contentWindow.focus();
  print(frame.contentWindow);
}
