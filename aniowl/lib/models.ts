
export interface IProviderStats {
  name: string;
  baseUrl: string;
  lang: string[] | string;
  isNSFW: boolean;
  logo: string;
  classPath: string;
  isWorking: boolean;
}

export interface ITitle {
  romaji?: string;
  english?: string;
  native?: string;
  userPreferred?: string;
}

export interface IAnimeResult {
  id: string;
  title: string | ITitle;
  url?: string;
  image?: string;
  imageHash?: string;
  cover?: string;
  coverHash?: string;
  status?: MediaStatus;
  rating?: number;
  type?: MediaFormat;
  releaseDate?: string;
  [x: string]: any; // other fields
}

export interface ISearch<T> {
  currentPage?: number;
  hasNextPage?: boolean;
  totalPages?: number;
  totalResults?: number;
  results: T[];
}

export enum MediaFormat {
  TV = 'TV',
  TV_SHORT = 'TV_SHORT',
  MOVIE = 'MOVIE',
  SPECIAL = 'SPECIAL',
  OVA = 'OVA',
  ONA = 'ONA',
  MUSIC = 'MUSIC',
  MANGA = 'MANGA',
  NOVEL = 'NOVEL',
  ONE_SHOT = 'ONE_SHOT',
  PV = 'PV',
  COMIC = 'COMIC',
  UNKNOWN = 'UNKNOWN',
}

export interface IAnimeInfo extends IAnimeResult {
  malId?: number | string;
  genres?: string[];
  description?: string;
  status?: MediaStatus;
  totalEpisodes?: number;
  hasSub?: boolean;
  hasDub?: boolean;
  synonyms?: string[];
  countryOfOrigin?: string;
  isAdult?: boolean;
  isLicensed?: boolean;
  season?: string;
  studios?: string[];
  color?: string;
  cover?: string;
  episodes?: IAnimeEpisode[];
  [x: string]: any;
}

export interface IAnimeEpisode {
  id: string;
  number: number;
  title?: string;
  description?: string;
  isFiller?: boolean;
  isSubbed?: boolean;
  isDubbed?: boolean;
  url?: string;
  image?: string;
  imageHash?: string;
  releaseDate?: string;
  [x: string]: unknown; // other fields
}

export interface IEpisodeServer {
  name: string;
  url: string;
  [x: string]: unknown;
}

export interface IVideo {
  url: string;
  quality?: string;
  isM3U8?: boolean;
  isDASH?: boolean;
  size?: number;
  [x: string]: unknown; // other fields
}

export enum StreamingServers {
  Luffy = 'luffy',
}

export enum MediaStatus {
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed',
  HIATUS = 'Hiatus',
  CANCELLED = 'Cancelled',
  NOT_YET_AIRED = 'Not yet aired',
  UNKNOWN = 'Unknown',
}

export enum SubOrSub {
  SUB = 'sub',
  DUB = 'dub',
  BOTH = 'both',
}

export enum WatchListType {
  WATCHING = 'watching',
  ONHOLD = 'on-hold',
  PLAN_TO_WATCH = 'plan to watch',
  DROPPED = 'dropped',
  COMPLETED = 'completed',
  NONE = 'none',
}

export interface ISource {
  headers?: { [k: string]: string };
  sources: IVideo[];
  download?: string;
}
