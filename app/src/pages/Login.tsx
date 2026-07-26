import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Welcome to PropLink</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email">
            <TabsList className="w-full">
              <TabsTrigger value="email" className="flex-1">
                Email
              </TabsTrigger>
              <TabsTrigger value="kimi" className="flex-1">
                Kimi
              </TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="mt-4">
              <EmailAuthForm />
            </TabsContent>
            <TabsContent value="kimi" className="mt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  window.location.href = getOAuthUrl();
                }}
              >
                Sign in with Kimi
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function EmailAuthForm() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const onSuccess = async () => {
    await utils.invalidate();
    navigate("/dashboard");
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const login = trpc.auth.login.useMutation({ onSuccess, onError });
  const register = trpc.auth.register.useMutation({ onSuccess, onError });
  const pending = login.isPending || register.isPending;

  const submit = () => {
    if (mode === "login") {
      login.mutate({ email, password });
    } else {
      register.mutate({ email, password, name: name.trim() || undefined });
    }
  };

  return (
    <div className="space-y-4">
      {mode === "register" && (
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            placeholder="Sarah Agent"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          placeholder="test1@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <Input
          type="password"
          placeholder="min 4 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      <Button
        className="w-full"
        disabled={pending || !email.includes("@") || password.length < 4}
        onClick={submit}
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <button
        className="w-full text-center text-xs text-muted-foreground underline hover:text-foreground"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "No account? Create one — no email verification needed"
          : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
