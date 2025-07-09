"use client";

import { useState } from "react";
import Link from 'next/link';
import { Bot, TestTube2, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Home() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleSetup = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/setup');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      setStatus('success');
      setMessage(data.message);
      toast({
        title: "Setup Successful",
        description: data.message,
      });
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message);
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIndicator = () => {
    switch(status) {
      case 'loading': return <div className="flex items-center gap-2"><Loader className="animate-spin" /> <span>Setting up...</span></div>;
      case 'success': return <div className="flex items-center gap-2 text-green-600"><CheckCircle /> <span>{message}</span></div>;
      case 'error': return <div className="flex items-center gap-2 text-red-600"><AlertCircle /> <span>{message}</span></div>;
      default: return null;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background font-body">
      <Card className="w-full max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center bg-card-foreground text-primary-foreground p-6">
          <div className="flex justify-center items-center gap-4">
            <Bot className="w-10 h-10" />
            <CardTitle className="text-4xl font-headline">TeleVerse Bot</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80 pt-2">
            Your Telegram Bot is almost ready!
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6 text-center">
            <div className="prose prose-sm max-w-none text-foreground">
                <h2 className="text-2xl font-semibold mb-4">Welcome!</h2>
                <p>
                    This application is the backend for your Telegram bot. To get started, you need to set up the webhook so Telegram knows where to send messages.
                </p>
                
                <h3 className="text-xl font-semibold mt-6 mb-2">Step 1: Set Your Bot Token</h3>
                <p>
                    Make sure you have added your Telegram Bot Token to the <code>.env</code> file in the project's root directory. The file should look like this:
                </p>
                <pre className="bg-muted p-3 rounded-md text-left text-sm"><code>TELEGRAM_BOT_TOKEN=...your_token_here...</code></pre>

                <h3 className="text-xl font-semibold mt-6 mb-2">Step 2: Set Up Webhook</h3>
                <p>
                    Click the button below to automatically register the webhook with Telegram. This only needs to be done once after your app is deployed.
                </p>
            </div>

            <Button onClick={handleSetup} disabled={status === 'loading'}>
              {status === 'loading' ? <Loader className="animate-spin mr-2"/> : '🚀'}
              Set Up Telegram Webhook
            </Button>

            {status !== 'idle' && (
                <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm">
                    {getStatusIndicator()}
                </div>
            )}

            <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-semibold mb-2">Test Your Commands</h3>
                <p className="text-muted-foreground mb-4">
                    Want to try out commands without using Telegram? Head over to the test page.
                </p>
                <Button asChild variant="outline">
                    <Link href="/test">
                        <TestTube2 className="mr-2" /> Go to Test Page
                    </Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
