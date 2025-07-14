
import { IVideo } from './models';
import VideoExtractor from './video-extractor';
import vm from 'node:vm';
import axios from 'axios';

class Luffy extends VideoExtractor {
  protected override serverName = 'luffy';
  protected override sources: IVideo[] = [];

  private readonly host = 'https://animeowl.me';

  override extract = async (videoUrl: URL): Promise<IVideo[]> => {
    try {
      const { data: server } = await this.client.get(videoUrl.href!);
      const jwtRegex = /([A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)/;
      const { data: script } = await this.client.get(
        `${this.host}/players/${videoUrl.href!.split('/').pop()}.v2.js`
      );
      const c = await this.deobfuscateScript(script);
      if (!c) {
        throw new Error('Deobfuscation failed, returned null.');
      }
      const jwt = jwtRegex.exec(c!)![0];
      server['luffy']?.map((item: any) => {
        this.sources.push({
          quality: item.url.match(/[?&]resolution=([^&]+)/)?.[1],
          url: item.url + jwt,
        });
      });

      return this.sources;
    } catch (err) {
      throw new Error((err as Error).message);
    }
  };

  private deobfuscateScript = async (source: string): Promise<string | null> => {
    const { data: synchronyScript } = await this.client.get(
      'https://raw.githubusercontent.com/Kohi-den/extensions-source/9328d12fcfca686becfb3068e9d0be95552c536f/lib/synchrony/src/main/assets/synchrony-v2.4.5.1.js'
    );
    let synchronyScriptText = synchronyScript as string;

    const regex = /export\{(.*?) as Deobfuscator,(.*?) as Transformer\};/;
    const match = synchronyScriptText.match(regex);
    if (!match) return null;

    const [fullMatch, deob, trans] = match;
    const replacement = `const Deobfuscator = ${deob}, Transformer = ${trans};`;
    synchronyScriptText = synchronyScriptText.replace(fullMatch, replacement);

    const context = {
      source,
      result: '',
      console: { log: () => {}, warn: () => {}, error: () => {}, trace: () => {} },
    };

    vm.createContext(context);

    try {
      vm.runInContext(synchronyScriptText, context);
      context.result = vm.runInContext(`new Deobfuscator().deobfuscateSource(source)`, context);
      return context.result;
    } catch (err) {
      console.error('Deobfuscation failed:', err);
      return null;
    }
  };
}
export default Luffy;
