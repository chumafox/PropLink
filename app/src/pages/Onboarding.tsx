import { useState } from "react";
import { useNavigate } from "react-router";
import Navbar from "@/components/Navbar";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PRO_ROLES } from "@contracts/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Home,
  TrendingUp,
  KeyRound,
  FileCheck,
  Banknote,
  Landmark,
  ClipboardList,
  Scale,
  Palmtree,
  ArrowRight,
} from "lucide-react";

const roleIcons: Record<string, any> = {
  buyer: Home,
  investor: TrendingUp,
  agent: KeyRound,
  title_company: FileCheck,
  private_lender: Banknote,
  hard_money_lender: Landmark,
  transaction_coordinator: ClipboardList,
  attorney: Scale,
  gator_lender: Palmtree,
};

export default function Onboarding() {
  const { user, isLoading } = useAuth({ redirectOnUnauthenticated: true });
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data: existing } = trpc.profile.me.useQuery(undefined, {
    enabled: !!user,
  });

  const [role, setRole] = useState<string>("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [license, setLicense] = useState("");
  const [markets, setMarkets] = useState("");
  const [bio, setBio] = useState("");

  const upsert = trpc.profile.upsert.useMutation({
    onSuccess: async () => {
      await utils.profile.me.invalidate();
      toast.success("Profile saved — welcome to PropLink");
      navigate("/dashboard");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return null;

  // Existing profile → prefill and allow editing role too
  if (existing && !role) {
    setRole(existing.proRole);
    setCompany(existing.company ?? "");
    setPhone(existing.phone ?? "");
    setLicense(existing.licenseNumber ?? "");
    setMarkets(existing.marketsServed ?? "");
    setBio(existing.bio ?? "");
  }

  const showLicense = ["agent", "attorney", "title_company"].includes(role);

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {existing ? "Your professional profile" : "Who are you in the deal?"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          PropLink connects everyone around a real-estate transaction. Pick your
          role — it defines your dashboard and tools.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PRO_ROLES.map((r) => {
            const Icon = roleIcons[r.value] ?? Home;
            return (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border bg-white p-4 text-center transition-all hover:border-primary/50",
                  role === r.value &&
                    "border-primary bg-primary/5 ring-2 ring-primary/20",
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    role === r.value ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="text-sm font-medium">{r.label}</span>
              </button>
            );
          })}
        </div>

        <Card className="mt-8 border-0 shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company / brokerage</Label>
                <Input
                  placeholder="e.g. Sunset Realty Group"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            {showLicense && (
              <div className="space-y-1.5">
                <Label>License number</Label>
                <Input
                  placeholder="State license #"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Markets served</Label>
              <Input
                placeholder="e.g. Austin, TX · Phoenix, AZ"
                value={markets}
                onChange={(e) => setMarkets(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Short bio</Label>
              <Textarea
                rows={3}
                placeholder="What should counterparties know about you?"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              disabled={!role || upsert.isPending}
              onClick={() =>
                upsert.mutate({
                  proRole: role as any,
                  company: company || undefined,
                  phone: phone || undefined,
                  licenseNumber: license || undefined,
                  marketsServed: markets || undefined,
                  bio: bio || undefined,
                  onboarded: 1,
                })
              }
            >
              {upsert.isPending ? "Saving…" : "Continue"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
