
import { IVideo } from './models';
import VideoExtractor from './video-extractor';
import axios from 'axios';

class Kwik extends VideoExtractor {
  protected override serverName = 'kwik';
  protected override sources: IVideo[] = [];

  private readonly host = 'https://animepahe.ru/';

  constructor() {
    super();
    this.client = axios.create();
  }

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    try {
      const response = await fetch(`${videoUrl.href}`, {
        headers: { Referer: this.host },
      });

      const data = await response.text();
      
      const sourceMatch = data.match(/https.*?m3u8/);
      if(!sourceMatch) {
          console.warn("Could not extract M3U8 source from Kwik.");
          return [];
      }
      const source = sourceMatch[0];

      this.sources.push({
        url: source,
        isM3U8: source.includes('.m3u8'),
      });

      return this.sources;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };
}
export default Kwik;
