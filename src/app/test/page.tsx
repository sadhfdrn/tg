
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Bot, Command, Send, User, Loader, TestTube2, ArrowLeft } from "lucide-react";
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { handleMessage } from "../actions";

type Media = {
  type: 'image' | 'video';
  url: string;
  caption: string;
};

type Message = {
  id: number;
  sender: "bot" | "user";
  text?: string;
  media?: Media[];
  isLoading?: boolean;
};

export default function TestPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        sender: "bot",
        text: "Welcome! Test commands here.\n\nUsage:\n- `/tiktok <url>`\n- `/tiktok-wm <url> <style.svg> <text>`",
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (
    sender: "bot" | "user",
    text?: string,
    media?: Media[],
    isLoading?: boolean
  ) => {
    const newMessage = { id: Date.now(), sender, text, media, isLoading };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  };
  
  const updateMessage = (id: number, text?: string, media?: Media[], isLoading?: boolean) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, text, media, isLoading } : msg));
  }

  const handleSendMessage = async () => {
    if (input.trim() === "") return;
    const userMessage = input;
    setInput("");
    addMessage("user", userMessage);
    const loadingMessageId = addMessage("bot", undefined, undefined, true);

    try {
      const response = await handleMessage(userMessage);
      updateMessage(loadingMessageId, response.text, response.media, false);
    } catch (error: any) {
        console.error(error);
        updateMessage(loadingMessageId, "Sorry, an unexpected error occurred.", undefined, false);
        toast({
            title: "Error",
            description: error.message || "Failed to get response from server.",
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
      <Card className="w-full max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden flex flex-col h-[90vh] max-h-[700px]">
        <CardHeader className="text-center bg-card-foreground text-primary-foreground p-6">
          <div className="flex justify-center items-center gap-4">
             <TestTube2 className="w-10 h-10" />
            <CardTitle className="text-4xl font-headline">
              Command Tester
            </CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80 pt-2">
            Test your bot commands here before using them in Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-grow overflow-hidden">
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-start gap-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500",
                  msg.sender === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.sender === "bot" && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot size={18} />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    "max-w-sm rounded-xl px-4 py-2.5 shadow-md",
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {msg.isLoading && <div className="flex items-center justify-center p-2"><Loader className="animate-spin" /></div>}
                  {msg.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                  {msg.media && (
                    <div className="mt-2 space-y-2">
                      {msg.media.map((m, i) => (
                        <div key={i}>
                          {m.type === 'image' ? (
                            <Image src={m.url} alt={m.caption} width={300} height={400} className="rounded-lg"/>
                          ) : (
                            <video src={m.url} controls className="w-full rounded-lg" />
                          )}
                          <p className="text-xs text-muted-foreground mt-1">{m.caption}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {msg.sender === "user" && (
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      <User size={18} />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </CardContent>
          
        <CardFooter className="p-6 bg-muted/50 border-t">
            <div className="flex w-full items-center gap-2">
              <Input
                type="text"
                placeholder="e.g. /tiktok <url>"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-grow"
              />
              <Button onClick={handleSendMessage} disabled={!input.trim()}>
                <Send className="mr-2 h-4 w-4" /> Send
              </Button>
            </div>
        </CardFooter>
      </Card>
    </main>
  );
}

    