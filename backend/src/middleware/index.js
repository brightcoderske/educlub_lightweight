const auth = require("./auth.middleware");
const role = require("./role.middleware");
const error = require("./error.middleware");

module.exports = {
  ...auth,
  ...role,
  ...error,
};
