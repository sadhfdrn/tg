
import { IVideo } from './models';
import VideoExtractor from './video-extractor';
import { getCookies } from './cookie-service';
import { load } from 'cheerio';

class Kwik extends VideoExtractor {
  protected override serverName = 'kwik';
  protected override sources: IVideo[] = [];

  private readonly host = 'https://animepahe.ru/';

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    try {
      const cookies = await getCookies();

      const response = await this.client.get(videoUrl.href, {
        headers: { 
          Referer: this.host,
          Cookie: cookies.kwik,
         },
      });

      const data = response.data;
      
      const sourceMatch = data.match(/https?:\/\/[^"]*?\.m3u8[^"]*/);
      
      if(!sourceMatch || !sourceMatch[0]) {
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
