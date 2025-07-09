"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import { Bot, TestTube2, CheckCircle, AlertCircle, Loader, MessageSquare } from "lucide-react";
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

  useEffect(() => {
    // We use sessionStorage to ensure this runs once per session,
    // avoiding re-running the setup on every page navigation.
    if (sessionStorage.getItem('webhook_setup_attempted')) {
      setStatus('success');
      setMessage('Webhook configuration was already attempted in this session.');
      return;
    }

    const handleSetup = async () => {
      sessionStorage.setItem('webhook_setup_attempted', 'true');
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
    
    handleSetup();
  }, [toast]);

  const getStatusIndicator = () => {
    switch(status) {
      case 'loading': return <div className="flex items-center justify-center gap-2"><Loader className="animate-spin" /> <span>Configuring bot webhook...</span></div>;
      case 'success': return <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle /> <span>{message || 'Webhook configured successfully!'}</span></div>;
      case 'error': return <div className="flex items-center justify-center gap-2 text-red-600"><AlertCircle /> <span>Configuration failed: {message}</span></div>;
      default: return null;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background font-body">
      <Card className="w-full max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center bg-card-foreground text-primary-foreground p-6">
          <div className="flex justify-center items-center gap-4">
            <Bot className="w-10 h-10" />
            <CardTitle className="text-4xl font-headline">TeleVerse Bot is Live!</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80 pt-2">
            Your Telegram Bot is running and ready for action.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6 text-center">
            <div className="prose prose-sm max-w-none text-foreground">
                <p>
                    Your bot should now be responding on Telegram. Go ahead and start a chat with it!
                </p>
                <p>
                    The webhook that connects your bot to Telegram is configured automatically when you visit this page.
                </p>
            </div>

            {status !== 'idle' && (
                <div className="mt-4 p-3 rounded-md bg-muted/50 text-sm">
                    {getStatusIndicator()}
                </div>
            )}

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
                <div className="flex flex-col items-center gap-2">
                    <h3 className="text-lg font-semibold">Test Your Commands</h3>
                    <p className="text-muted-foreground text-sm">
                        Use the test page to try commands without using Telegram.
                    </p>
                    <Button asChild variant="outline">
                        <Link href="/test">
                            <TestTube2 className="mr-2" /> Go to Test Page
                        </Link>
                    </Button>
                </div>
                 <div className="flex flex-col items-center gap-2">
                    <h3 className="text-lg font-semibold">Broadcast Tool</h3>
                    <p className="text-muted-foreground text-sm">
                        Send a message from your bot to a specific user.
                    </p>
                    <Button asChild variant="outline">
                        <Link href="/send-message">
                            <MessageSquare className="mr-2" /> Send a Message
                        </Link>
                    </Button>
                </div>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}
