'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Search, Loader, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { searchAnime, getAnimeInfo, getEpisodeSources } from './actions';
import { IAnimeInfo, IAnimeResult, ISearch } from '@/lib/anime-scrapper/models';

type AnimeResultWithInfo = IAnimeResult & { info?: IAnimeInfo };

export default function AnimePage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ISearch<AnimeResultWithInfo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState<Record<string, boolean>>({});
  const [sourceLoading, setSourceLoading] = useState<Record<string, boolean>>({});

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearchResults(null);
    try {
      const results = await searchAnime(query);
      setSearchResults(results);
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to search for anime.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFetchInfo = async (animeId: string, index: number) => {
    setInfoLoading(prev => ({ ...prev, [animeId]: true }));
    try {
      const info = await getAnimeInfo(animeId);
      setSearchResults(prev => {
        if (!prev) return null;
        const newResults = [...prev.results];
        newResults[index].info = info;
        return { ...prev, results: newResults };
      });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to fetch anime details.', variant: 'destructive' });
    } finally {
      setInfoLoading(prev => ({ ...prev, [animeId]: false }));
    }
  };

  const handleDownload = async (episodeId: string, episodeTitle: string) => {
    setSourceLoading(prev => ({ ...prev, [episodeId]: true }));
    try {
      const sources = await getEpisodeSources(episodeId);
      const source = sources.sources.find(s => s.quality === 'default') || sources.sources[0];
      
      if (!source?.url) {
        throw new Error('No download source found.');
      }
      
      toast({ title: 'Preparing Download', description: 'Your download will begin shortly...' });

      // Fetch the video through the proxy
      const proxyUrl = `/api/anime-proxy?url=${encodeURIComponent(source.url)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary link to trigger the download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanTitle = (episodeTitle.replace(/[^a-z0-9]/gi, '_') || episodeId) + '.mp4';
      link.setAttribute('download', cleanTitle);
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up the temporary link and blob URL
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Download started.' });

    } catch (error) {
      console.error(error);
      const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred.';
      toast({ title: 'Error', description: `Failed to start download: ${errorMessage}`, variant: 'destructive' });
    } finally {
      setSourceLoading(prev => ({ ...prev, [episodeId]: false }));
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Anime Downloader</CardTitle>
          <CardDescription>Search for your favorite anime and download episodes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search for an anime..."
              className="flex-grow"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? <Loader className="animate-spin" /> : <Search />}
            </Button>
          </div>

          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {searchResults?.results.map((anime, index) => (
                <Card key={anime.id} className="overflow-hidden">
                  <Accordion type="single" collapsible>
                    <AccordionItem value={anime.id}>
                      <AccordionTrigger
                        className="p-4 hover:no-underline"
                        onClick={() => !anime.info && handleFetchInfo(anime.id, index)}
                      >
                        <div className="flex gap-4 items-center w-full">
                          <Image
                            src={anime.image || 'https://placehold.co/100x150.png'}
                            alt={typeof anime.title === 'string' ? anime.title : (anime.title as any).english || ''}
                            width={75}
                            height={112}
                            className="rounded-md object-cover"
                          />
                          <div className="text-left flex-grow">
                            <h3 className="font-bold text-lg">{typeof anime.title === 'string' ? anime.title : (anime.title as any).english || (anime.title as any).romaji}</h3>
                            <div className="text-sm text-muted-foreground">{anime.type}</div>
                          </div>
                          {infoLoading[anime.id] && <Loader className="animate-spin mr-2" />}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 pt-0">
                        {anime.info ? (
                          <>
                            <div className="flex flex-wrap gap-1 mb-2">
                                {anime.info.genres?.map(genre => (
                                    <Badge key={genre} variant="secondary">{genre}</Badge>
                                ))}
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">{anime.info.description}</p>
                            <h4 className="font-semibold mb-2">Episodes</h4>
                            <ScrollArea className="h-64 pr-3">
                              <ul className="space-y-2">
                                {anime.info.episodes?.map(ep => (
                                  <li key={ep.id} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
                                    <span className="text-sm">{ep.title}</span>
                                    <Button size="sm" onClick={() => handleDownload(ep.id, ep.title || `episode_${ep.number}`)} disabled={sourceLoading[ep.id]}>
                                      {sourceLoading[ep.id] ? <Loader className="animate-spin" /> : <Download size={16} />}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </ScrollArea>
                          </>
                        ) : (
                          <p>Click to load details...</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
