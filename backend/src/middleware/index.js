const auth = require('./auth.middleware');
const role = require('./role.middleware');
const schoolScope = require('./schoolScope.middleware');
const error = require('./error.middleware');

module.exports = {
  ...auth,
  ...role,
  ...schoolScope,
  ...error,
};
