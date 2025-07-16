
import axios, { AxiosInstance } from 'axios';

export abstract class BaseProvider {
  /**
   * Name of the provider
   */
  abstract readonly name: string;

  /**
   * The main URL of the provider
   */
  protected abstract readonly baseUrl: string;

  /**
   * Logo of the provider
   */
  protected abstract readonly logo: string;

  /**
   * The class's path is determined by the provider's directory structure for example:
   * MangaDex class path is `MANGA.MangaDex`. **(case sensitive)**
   */
  protected abstract readonly classPath: string;

  /**
   * override as `false` if the provider is **down** or **not working**
   */
  readonly isWorking: boolean = true;

  protected client: AxiosInstance;

  constructor() {
    this.client = axios.create();
  }
}

export default BaseProvider;
