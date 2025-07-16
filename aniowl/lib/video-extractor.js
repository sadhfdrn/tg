

const BaseProvider = require('./base-provider.js');

class VideoExtractor extends BaseProvider {
  extract(videoUrl, ...args) {
    throw new Error('Method not implemented.');
  }
}

module.exports = VideoExtractor;
