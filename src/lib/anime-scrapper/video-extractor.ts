import { IVideo, ISource } from './models';
import BaseProvider from './base-provider';

abstract class VideoExtractor extends BaseProvider {
  /**
   * The server name of the video provider
   */
  protected abstract serverName: string;

  /**
   * list of videos available
   */
  protected abstract sources: IVideo[];

  /**
   * takes video link
   *
   * returns video sources (video links) available
   */
  protected abstract extract(videoUrl: URL, ...args: any): Promise<IVideo[] | ISource>;
}

export default VideoExtractor;
