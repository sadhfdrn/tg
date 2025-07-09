"use client";

import { useState } from "react";
import Link from 'next/link';
import { MessageSquare, Send, Bot, Loader, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { sendMessageToUser } from "../actions";

export default function SendMessagePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setResult("");
    
    const formData = new FormData(event.currentTarget);
    const response = await sendMessageToUser(formData);

    setLoading(false);
    
    if (response.success) {
      setResult(`Success: ${response.message}`);
      toast({
        title: "Message Sent",
        description: response.message,
      });
    } else {
      setResult(`Error: ${response.message}`);
      toast({
        title: "Failed to Send",
        description: response.message,
        variant: "destructive",
      });
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background font-body">
       <div className="absolute top-4 left-4">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2" /> Back to Home
          </Link>
        </Button>
      </div>
      <Card className="w-full max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center bg-card-foreground text-primary-foreground p-6">
          <div className="flex justify-center items-center gap-4">
            <Bot className="w-10 h-10" />
            <CardTitle className="text-4xl font-headline">Bot Broadcast Tool</CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80 pt-2">
            Send a message to any Telegram user from your bot.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4">
              <div>
                  <label htmlFor="chatId" className="block text-sm font-medium text-foreground mb-1">User or Chat ID</label>
                  <Input 
                    id="chatId"
                    name="chatId"
                    type="text" 
                    placeholder="Enter the target Chat ID"
                    required
                    className="bg-muted/50"
                  />
              </div>
              <div>
                  <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">Message</label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Type your message here..."
                    required
                    rows={5}
                    className="bg-muted/50"
                  />
              </div>
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-4 p-6 bg-muted/50 border-t">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader className="animate-spin mr-2" /> : <Send className="mr-2" />}
                Send Message
              </Button>
              {result && (
                <p className={`text-sm ${result.startsWith("Error") ? 'text-red-600' : 'text-green-600'}`}>
                  {result}
                </p>
              )}
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
