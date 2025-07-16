

const BaseProvider = require('./base-provider');

class VideoExtractor extends BaseProvider {
  extract(videoUrl, ...args) {
    throw new Error('Method not implemented.');
  }
}

module.exports = VideoExtractor;
