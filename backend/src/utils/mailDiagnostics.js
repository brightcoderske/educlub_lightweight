const { resolveMailIdentity } = require("./emailConfig");

/**
 * What the mailer will really use, in a form that is safe to print or log.
 *
 * "Email does not work" is almost always "the process is using different
 * settings from the ones somebody is looking at", so the first thing worth
 * knowing is what it is using. The password is reported as a length only.
 */
function describeMailSettings(env) {
  const identity = resolveMailIdentity(env);
  const password = String(env.emailPassword || "");
  const notes = [];

  if (/\s/.test(password)) {
    notes.push(
      "EMAIL_PASSWORD contains whitespace. It is removed before login, because app passwords are usually pasted with spaces in them; if the real password contains a space, the login is refused.",
    );
  }
  if (/^(["']).*\1$/.test(password)) {
    notes.push(
      "EMAIL_PASSWORD is wrapped in quotes. A .env file drops them, but a value typed into a hosting panel keeps them, and then they are part of the password.",
    );
  }

  return {
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailSecure,
    user: env.emailUser,
    passwordLength: password.length,
    from: identity.from,
    replyTo: identity.replyTo || null,
    aligned: identity.aligned,
    configuredFrom: identity.configuredFrom,
    tlsServername: env.emailTlsServername || null,
    tlsVerified: env.emailTlsRejectUnauthorized !== false,
    notes,
  };
}

/**
 * Next steps for a failed connection, login or send. `failure` is what the
 * mailer records: { code, message }. Returns lines; empty when the failure is
 * not one of the recognised kinds, so an unfamiliar error is never dressed up
 * as a familiar one.
 */
function explainMailFailure(failure, settings) {
  const code = String(failure?.code || "");
  const message = String(failure?.message || "");
  const server = `${settings.host}:${settings.port}`;

  if (code === "EAUTH" || /\b535\b/.test(message)) {
    return [
      `The mail server (${server}) refused the login for ${settings.user}.`,
      "  - EMAIL_USER must be the full address of a real mailbox (cPanel > Email Accounts). A forwarder has no password, so it cannot log in.",
      "  - EMAIL_PASSWORD must be that mailbox's current password. If unsure, set a new one in cPanel and put the same value here.",
      "  - If EMAIL_USER is not what .env says, a variable in the process environment (the hosting panel, or the shell) is overriding .env.",
    ];
  }

  if (
    ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH"].includes(code)
  ) {
    const lines = [
      `Could not complete a connection to ${server}.`,
      "  - Check EMAIL_HOST and EMAIL_PORT. The usual pairs are 465 with EMAIL_SECURE=true, or 587 with EMAIL_SECURE=false.",
    ];
    if (/cert|tls|ssl|altname|self.signed|handshake/i.test(message)) {
      lines.push(
        "  - The certificate check failed. Set EMAIL_TLS_SERVERNAME to the hostname the certificate is issued for, rather than turning verification off.",
      );
    }
    return lines;
  }

  if (code === "EENVELOPE" || code === "EMESSAGE") {
    return [
      "The server accepted the login but refused the message.",
      "  - EMAIL_FROM should be a mailbox or alias on the same domain as EMAIL_USER.",
      "  - Check the recipient address, and read the server's reply above.",
    ];
  }

  return [];
}

/**
 * The block the mail scripts print before doing anything, so the output starts
 * with what is being tested. `env` is the object from config/env.
 */
function formatMailReport(env) {
  const settings = describeMailSettings(env);
  const lines = [
    "Mail settings in effect",
    `  Server     : ${settings.host}:${settings.port} (${settings.secure ? "SSL/TLS" : "STARTTLS"})`,
    `  Login      : ${settings.user} (password: ${settings.passwordLength} characters)`,
    `  Sending as : ${settings.from}`,
    `  Reply-To   : ${settings.replyTo || "(none)"}`,
    `  Read from  : ${env.envFile}${env.envFileFound ? "" : " (no such file)"}`,
  ];

  if (!settings.tlsVerified) {
    lines.push("  TLS        : certificate checking is OFF (EMAIL_TLS_REJECT_UNAUTHORIZED=false)");
  } else if (settings.tlsServername) {
    lines.push(`  TLS        : certificate must be issued for ${settings.tlsServername}`);
  }

  if (!settings.aligned) {
    lines.push(
      `  Note       : EMAIL_FROM (${settings.configuredFrom}) is not on the domain of ${settings.user}, so mail is sent as ${settings.user} and EMAIL_FROM is used as Reply-To. Set EMAIL_ALLOW_UNALIGNED_FROM=true only if the host is authorised to send for that domain.`,
    );
  }

  const overridden = (env.envShadowedKeys || []).filter((key) => key.startsWith("EMAIL_"));
  if (overridden.length) {
    lines.push(
      `  Override   : ${overridden.join(", ")} ${overridden.length === 1 ? "is" : "are"} also set in the process environment with a different value. That value wins and the one in .env is ignored. Remove it from the environment (the hosting panel, or the shell), or make the two match.`,
    );
  }

  for (const note of settings.notes) lines.push(`  Note       : ${note}`);
  return lines;
}

/**
 * What the application says about mail when it starts: what it is using,
 * anything in the environment that is overriding .env, and whether it can log
 * in. Mail that is sent as a domain the account cannot authenticate for is
 * accepted by the transport and then filed as spam or refused by the receiving
 * server, which looks exactly like "email is broken" - so the application says
 * so itself. It is also the one place that sees the environment the process
 * really runs with; a shell session does not.
 *
 * The logger and the login check are passed in so this can be tested without a
 * network. Returns the promise for the login check.
 */
function reportMailStartup({ env, log, verifyLogin }) {
  const mail = describeMailSettings(env);

  log.info("email_identity", {
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    user: mail.user,
    passwordLength: mail.passwordLength,
    from: mail.from,
    replyTo: mail.replyTo,
  });
  mail.notes.forEach((note) => log.warn("email_setting_note", { note }));

  if (!mail.aligned) {
    log.info("email_from_realigned", {
      configuredFrom: mail.configuredFrom,
      sendingAs: mail.user,
      reason:
        "EMAIL_FROM is not on the domain of EMAIL_USER, so mail is sent as EMAIL_USER and EMAIL_FROM is used as Reply-To.",
    });
  }

  const overridden = env.envShadowedKeys || [];
  if (overridden.length) {
    log.warn("env_overridden_by_process_environment", {
      keys: overridden,
      envFile: env.envFile,
      reason:
        "Set in the process environment (the hosting panel, or the shell) to a different value from .env, so the .env value is ignored.",
    });
  }

  return verifyLogin().then((result) => {
    const where = { user: mail.user, host: mail.host, port: mail.port };
    if (result.ok) {
      log.info("email_login_ok", where);
    } else {
      log.warn("email_login_failed", {
        ...where,
        code: result.code,
        response: result.message,
        hints: explainMailFailure(result, mail),
      });
    }
  });
}

module.exports = {
  describeMailSettings,
  explainMailFailure,
  formatMailReport,
  reportMailStartup,
};
