
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader, Search, ArrowLeft, Clapperboard, Download } from 'lucide-react';
import { searchAnime, getAnimeDetails, getAnimeSeason } from './actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type SearchResult = {
  id: string;
  title: string;
  poster: string;
  year: string;
  status: string;
  type: string;
};

type AnimeDetails = {
    title: string;
    description: string;
    poster: string;
    year: string;
    status: string;
    genres: string[];
    episodes: string;
    duration: string;
    studio: string;
    score: string;
};

type DownloadLink = {
    server: string;
    url: string;
    quality: string;
    type: string;
    episode: number;
};

export default function AnimeDownloaderPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedAnime, setSelectedAnime] = useState<SearchResult | null>(null);
  const [details, setDetails] = useState<AnimeDetails | null>(null);
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setLoading(true);
    setResults([]);
    setSelectedAnime(null);
    setDetails(null);
    setDownloadLinks([]);

    const response = await searchAnime(query);
    if (response.success) {
      setResults(response.data);
      if(response.data.length === 0){
        toast({ title: "No results found", description: "Try a different search term."});
      }
    } else {
      toast({ title: 'Search failed', description: response.error, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSelectAnime = async (anime: SearchResult) => {
    setSelectedAnime(anime);
    setLoading(true);
    setDetails(null);
    setDownloadLinks([]);
    
    const detailsResponse = await getAnimeDetails(anime.id);
    if(detailsResponse.success){
        setDetails(detailsResponse.data);
    } else {
        toast({ title: 'Failed to get details', description: detailsResponse.error, variant: 'destructive' });
    }

    const seasonResponse = await getAnimeSeason(anime.id);
    if(seasonResponse.success){
        setDownloadLinks(seasonResponse.data);
    } else {
        toast({ title: 'Failed to get download links', description: seasonResponse.error, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleBackToSearch = () => {
    setSelectedAnime(null);
    setDetails(null);
    setDownloadLinks([]);
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background font-body">
      <div className="absolute top-4 left-4">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2" /> Back to Home
          </Link>
        </Button>
      </div>

      <Card className="w-full max-w-4xl mx-auto shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center bg-card-foreground text-primary-foreground p-6">
            <div className="flex justify-center items-center gap-4">
                <Clapperboard className="w-10 h-10" />
                <CardTitle className="text-4xl font-headline">Anime Downloader</CardTitle>
            </div>
            <CardDescription className="text-primary-foreground/80 pt-2">
                Search for anime and get download links.
            </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
            {selectedAnime && details ? (
                 <div>
                    <Button onClick={handleBackToSearch} variant="outline" className="mb-4">
                        <ArrowLeft className="mr-2"/> Back to Search Results
                    </Button>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <Image src={details.poster} alt={details.title} width={300} height={450} className="rounded-lg shadow-lg w-full" />
                        </div>
                        <div className="md:col-span-2">
                            <h2 className="text-3xl font-bold mb-2">{details.title}</h2>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded-md">{details.year}</span>
                                <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded-md">{details.status}</span>
                                <span className="text-sm bg-muted text-muted-foreground px-2 py-1 rounded-md">{details.episodes} episodes</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4">{details.description}</p>
                            <div className="mb-4">
                                <h4 className="font-semibold mb-2">Genres</h4>
                                <div className="flex flex-wrap gap-2">
                                    {details.genres.map(g => <span key={g} className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full">{g}</span>)}
                                </div>
                            </div>
                             <div>
                                <h3 className="text-xl font-semibold mb-2">Download Links</h3>
                                {loading && <div className="flex items-center gap-2"><Loader className="animate-spin" /> <span>Loading links...</span></div>}
                                {downloadLinks.length > 0 ? (
                                    <Accordion type="single" collapsible className="w-full">
                                        {downloadLinks.map((link, index) => (
                                             <AccordionItem value={`item-${index}`} key={index}>
                                                <AccordionTrigger>Episode {link.episode} - {link.server} ({link.quality})</AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="flex items-center gap-2">
                                                        <Input value={link.url} readOnly className="flex-grow"/>
                                                        <Button asChild>
                                                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                                                                <Download/>
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : !loading && (
                                    <p className="text-muted-foreground">No download links found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                 </div>
            ) : (
                <>
                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                    <Input
                        type="search"
                        placeholder="Search for an anime..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-grow"
                    />
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader className="animate-spin" /> : <Search />}
                    </Button>
                </form>

                {loading && !results.length && (
                    <div className="text-center">
                        <Loader className="animate-spin mx-auto h-8 w-8 text-primary"/>
                        <p className="text-muted-foreground mt-2">Searching...</p>
                    </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {results.map((anime) => (
                    <Card key={anime.id} className="overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary transition-all" onClick={() => handleSelectAnime(anime)}>
                        <Image src={`/api/image-proxy?url=${encodeURIComponent(anime.poster)}`} alt={anime.title} width={200} height={300} className="w-full h-auto object-cover" />
                        <div className="p-2">
                            <p className="font-semibold text-sm truncate">{anime.title}</p>
                            <p className="text-xs text-muted-foreground">{anime.year} - {anime.status}</p>
                        </div>
                    </Card>
                    ))}
                </div>
                </>
            )}

        </CardContent>
      </Card>
    </main>
  );
}

    