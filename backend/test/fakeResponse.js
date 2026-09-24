// A stand-in for an Express response that keeps what a controller sent, so a
// test can assert on the status and body without running a server.
function fakeResponse() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

module.exports = { fakeResponse };
