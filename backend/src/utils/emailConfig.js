function buildMailDefaults(env) {
  return {
    from: env.emailFrom,
    replyTo: env.emailReplyTo,
  };
}

function buildTransportOptions(env) {
  return {
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailSecure,
    auth: {
      user: env.emailUser,
      pass: env.emailPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };
}

module.exports = {
  buildMailDefaults,
  buildTransportOptions,
};
