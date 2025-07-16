

const MediaFormat = {
  TV: 'TV',
  TV_SHORT: 'TV_SHORT',
  MOVIE: 'MOVIE',
  SPECIAL: 'SPECIAL',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'MUSIC',
  MANGA: 'MANGA',
  NOVEL: 'NOVEL',
  ONE_SHOT: 'ONE_SHOT',
  PV: 'PV',
  COMIC: 'COMIC',
  UNKNOWN: 'UNKNOWN',
};

const StreamingServers = {
  Luffy: 'luffy',
};

const MediaStatus = {
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  HIATUS: 'Hiatus',
  CANCELLED: 'Cancelled',
  NOT_YET_AIRED: 'Not yet aired',
  UNKNOWN: 'Unknown',
};

const SubOrSub = {
  SUB: 'sub',
  DUB: 'dub',
  BOTH: 'both',
};

const WatchListType = {
  WATCHING: 'watching',
  ONHOLD: 'on-hold',
  PLAN_TO_WATCH: 'plan to watch',
  DROPPED: 'dropped',
  COMPLETED: 'completed',
  NONE: 'none',
};

module.exports = {
  MediaFormat,
  StreamingServers,
  MediaStatus,
  SubOrSub,
  WatchListType,
};
