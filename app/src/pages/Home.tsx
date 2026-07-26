import { useState } from "react";
import { useNavigate, Link } from "react-router";
import Navbar from "@/components/Navbar";
import ListingCard from "@/components/ListingCard";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PRO_ROLES } from "@contracts/constants";
import {
  Search,
  Home as HomeIcon,
  Send,
  Users,
  ArrowRight,
  ShieldCheck,
  FileText,
  Zap,
} from "lucide-react";

const steps = [
  {
    icon: HomeIcon,
    title: "List for free",
    text: "Agents and owners publish properties in minutes — single form or bulk CSV/JSON import.",
  },
  {
    icon: Send,
    title: "Offers that actually arrive",
    text: "Structured offers with proof of funds go directly to the decision maker. No more lost emails — every offer gets a status.",
  },
  {
    icon: Users,
    title: "Close with your deal team",
    text: "Title, lenders, coordinators and attorneys — the whole transaction crew on one platform.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data } = trpc.listings.search.useQuery({ limit: 6, sort: "newest" });

  const search = () => {
    navigate(q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}` : "/listings");
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src="/photos/hero.jpg"
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        </div>
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 py-28 text-center sm:px-6 sm:py-36">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl">
            Where offers reach{" "}
            <span className="text-primary">decision makers</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/85">
            Free listings for agents. Direct, trackable offers for buyers and
            investors. The whole deal team — one platform.
          </p>
          <div className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-full bg-white p-2 shadow-xl">
            <Search className="ml-3 h-5 w-5 shrink-0 text-muted-foreground" />
            <Input
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder="City, ZIP or address…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button className="rounded-full px-6" onClick={search}>
              Search
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-white/80">
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" /> Free for agents
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Verified offers
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> CSV / JSON import
            </span>
          </div>
        </div>
      </section>

      {/* Featured listings */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Fresh on PropLink</h2>
            <p className="mt-1 text-muted-foreground">
              Listed directly by agents and owners — no middlemen.
            </p>
          </div>
          <Link
            to="/listings"
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            Browse all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
        <div className="mt-8 text-center sm:hidden">
          <Button variant="outline" onClick={() => navigate("/listings")}>
            Browse all listings
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            How PropLink works
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.text}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">
          Built for every side of the deal
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Real estate is a team sport. PropLink connects all the professionals
          around a transaction — not just buyers and sellers.
        </p>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {PRO_ROLES.map((r) => (
            <div
              key={r.value}
              className="rounded-xl border bg-white p-4 text-center text-sm font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              {r.label}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-950 py-16 text-center text-white">
        <h2 className="text-2xl font-bold sm:text-3xl">
          List your first property today — free
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/70">
          Join agents, investors and transaction professionals building direct
          connections.
        </p>
        <Button
          size="lg"
          className="mt-6"
          onClick={() => navigate("/login")}
        >
          Get started <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        PropLink — connecting buyers, sellers and deal professionals. MVP build.
      </footer>
    </div>
  );
}
