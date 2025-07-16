

const BaseProvider = require('./base-provider');

class BaseParser extends BaseProvider {
  search(query, ...args) {
    throw new Error('Method not implemented.');
  }
}

module.exports = BaseParser;
