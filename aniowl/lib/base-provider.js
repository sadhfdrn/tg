

const axios = require('axios');

class BaseProvider {
  isWorking = true;

  constructor() {
    this.client = axios.create();
  }
}

module.exports = BaseProvider;
