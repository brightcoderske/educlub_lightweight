/**
 * Who eduClub mail comes from, and how it connects. Every value is read from
 * .env, so moving between mail providers is a configuration change and never a
 * code change.
 *
 * The one rule worth knowing: a From address has to belong to the domain the
 * SMTP account authenticates for. Mail providers sign outgoing mail for that
 * domain, so a From address on a different one fails SPF and DKIM alignment at
 * the receiving end and is filed as spam or refused - which is exactly what
 * "our emails are not arriving" looks like. The transport accepts the message,
 * the log says sent, and nobody receives it.
 *
 * With a normal cPanel mailbox (EMAIL_USER a mailbox on the domain, EMAIL_FROM on
 * that same domain) nothing below changes anything. It only steps in when the
 * two domains differ - sending through a Gmail account as an address on another
 * domain, say - where it sends as the mailbox that authenticated and keeps the
 * configured address as Reply-To, so replies still land in the right place. Set
 * EMAIL_ALLOW_UNALIGNED_FROM=true to send exactly what EMAIL_FROM says.
 *
 * Nothing here supplies an address or a sender name of its own. Whatever is not
 * in .env is left out rather than filled in from the code.
 */

/** "eduClub <a@b.c>" -> { name: "eduClub", address: "a@b.c" } */
function parseAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) return { name: "", address: "" };

  const angled = raw.match(/^(.*?)<([^>]+)>\s*$/);
  if (angled) {
    return {
      name: angled[1].trim().replace(/^"(.*)"$/, "$1"),
      address: angled[2].trim(),
    };
  }
  return { name: "", address: raw };
}

function formatAddress({ name, address }) {
  return name ? `${name} <${address}>` : address;
}

const domainOf = (address) => String(address || "").split("@").pop().toLowerCase();

function resolveMailIdentity(env) {
  const configured = parseAddress(env.emailFrom);
  const authenticated = String(env.emailUser || "").trim();

  // Alignment is a domain-level test because that is what SPF, DKIM and DMARC
  // check. A cPanel account may legitimately authenticate as one mailbox and
  // send as another on the same domain.
  const aligned =
    !authenticated ||
    !configured.address ||
    env.emailAllowUnalignedFrom === true ||
    domainOf(configured.address) === domainOf(authenticated);

  if (aligned) {
    return {
      aligned: true,
      from: formatAddress(configured),
      replyTo: env.emailReplyTo || undefined,
      configuredFrom: configured.address,
      authenticated,
    };
  }

  return {
    aligned: false,
    from: formatAddress({ name: configured.name, address: authenticated }),
    replyTo: env.emailReplyTo || configured.address || undefined,
    configuredFrom: configured.address,
    authenticated,
  };
}

function buildMailDefaults(env) {
  const identity = resolveMailIdentity(env);
  return {
    from: identity.from,
    ...(identity.replyTo ? { replyTo: identity.replyTo } : {}),
  };
}

function buildTransportOptions(env) {
  const tls = {};
  // Shared hosting frequently presents a certificate for the server's own
  // hostname instead of mail.yourdomain. Naming the expected host keeps
  // verification switched on rather than turning it off.
  if (env.emailTlsServername) tls.servername = env.emailTlsServername;
  if (env.emailTlsRejectUnauthorized === false) tls.rejectUnauthorized = false;

  return {
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailSecure,
    // On 587 the connection starts in plain text and upgrades. Without this a
    // failed upgrade silently continues unencrypted.
    ...(!env.emailSecure && env.emailRequireTls ? { requireTLS: true } : {}),
    auth: {
      user: env.emailUser,
      // Mail providers show app passwords in spaced groups and people paste
      // them as shown. The provider ignores the spaces; SMTP AUTH must not
      // carry them.
      pass: String(env.emailPassword || "").replace(/\s+/g, ""),
    },
    ...(Object.keys(tls).length ? { tls } : {}),
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
}

module.exports = {
  buildMailDefaults,
  buildTransportOptions,
  resolveMailIdentity,
};
