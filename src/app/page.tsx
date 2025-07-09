"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, Command, Power, Send, User } from "lucide-react";

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

type Message = {
  id: number;
  sender: "bot" | "user";
  text: string;
};

const placeholderCommands = ["start", "help", "settings", "status"];

export default function Home() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        sender: "bot",
        text: "Welcome to TeleVerse! Please enter your Telegram Bot API token to get started.",
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleConnect = () => {
    if (token.trim().match(/^\d{8,10}:[a-zA-Z0-9_-]{35}$/)) {
      setIsConnected(true);
      addMessage("bot", "Successfully connected! The bot is now initialized.");
      setTimeout(() => addMessage("bot", "Here are some available commands you can try."), 500);
    } else {
      toast({
        title: "Invalid API Token",
        description: "Please enter a valid Telegram Bot API token.",
        variant: "destructive",
      });
    }
  };
  
  const handleDisconnect = () => {
    setIsConnected(false);
    setToken("");
    addMessage("bot", "You have been disconnected. Enter a token to connect again.");
  }

  const addMessage = (sender: "bot" | "user", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now(), sender, text }]);
  };

  const handleCommand = (command: string) => {
    addMessage("user", `/${command}`);
    setTimeout(() => {
      addMessage(
        "bot",
        `The /${command} command is a placeholder and has not been implemented yet.`
      );
    }, 500);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-background font-body">
      <Card className="w-full max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden flex flex-col h-[90vh] max-h-[700px]">
        <CardHeader className="text-center bg-card-foreground text-primary-foreground p-6">
          <div className="flex justify-center items-center gap-4">
             <Bot className="w-10 h-10" />
            <CardTitle className="text-4xl font-headline">
              TeleVerse
            </CardTitle>
          </div>
          <CardDescription className="text-primary-foreground/80 pt-2">
            Your portal to the Telegram universe. Manage your bot with elegance and ease.
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
                  <p className="text-sm leading-relaxed">{msg.text}</p>
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
          
        {isConnected && (
            <div className="p-4 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2 text-center font-semibold tracking-wider uppercase">Available Commands</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {placeholderCommands.map((cmd) => (
                  <Button
                    key={cmd}
                    variant="outline"
                    size="sm"
                    onClick={() => handleCommand(cmd)}
                    className="bg-accent/20 hover:bg-accent/40 border-accent/30 text-accent-foreground/80"
                  >
                    <Command size={14} className="mr-2" />/{cmd}
                  </Button>
                ))}
              </div>
            </div>
        )}

        <CardFooter className="p-6 bg-muted/50 border-t">
          {!isConnected ? (
            <div className="flex w-full items-center gap-2">
              <Input
                type="password"
                placeholder="Enter your Telegram Bot API token..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                className="flex-grow"
              />
              <Button onClick={handleConnect} disabled={!token.trim()}>
                <Send className="mr-2 h-4 w-4" /> Connect
              </Button>
            </div>
          ) : (
            <div className="w-full flex justify-end">
                <Button onClick={handleDisconnect} variant="destructive">
                    <Power className="mr-2 h-4 w-4" /> Disconnect
                </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
