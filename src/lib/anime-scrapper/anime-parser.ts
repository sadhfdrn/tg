import { IAnimeInfo, ISource, IEpisodeServer, ISearch, IAnimeResult } from './models';
import BaseParser from './base-parser';
import { AxiosAdapter } from 'axios';

abstract class AnimeParser extends BaseParser {
  /**
   * if the provider has dub and it's avialable seperatly from sub set this to `true`
   */
  protected readonly isDubAvailableSeparately: boolean = false;
  /**
   * takes anime id
   *
   * returns anime info (including episodes)
   */
  abstract fetchAnimeInfo(animeId: string, ...args: any): Promise<IAnimeInfo>;

  /**
   * takes episode id
   *
   * returns episode sources (video links)
   */
  abstract fetchEpisodeSources(episodeId: string, ...args: any): Promise<ISource>;

  /**
   * takes episode id
   *
   * returns episode servers (video links) available
   */
  abstract fetchEpisodeServers(episodeId: string, ...args: any): Promise<IEpisodeServer[]>;

  override search(query: string, ...args: any): Promise<ISearch<IAnimeResult>> {
    throw new Error('Method not implemented.');
  }
}

export default AnimeParser;
