import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import ListingCard from "@/components/ListingCard";
import { PROPERTY_TYPES } from "@contracts/constants";
import { Target, Bell } from "lucide-react";
import { toast } from "sonner";

export default function BuyBoxTab() {
  const utils = trpc.useUtils();
  const { data: bb } = trpc.notifications.buyBox.useQuery();
  const { data: matches } = trpc.notifications.buyBoxMatches.useQuery();

  const [name, setName] = useState("My buy box");
  const [states, setStates] = useState("");
  const [cities, setCities] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [minBeds, setMinBeds] = useState("");
  const [keywords, setKeywords] = useState("");
  const [alertOn, setAlertOn] = useState(true);

  useEffect(() => {
    if (bb) {
      setName(bb.name);
      setStates((bb.states ?? []).join(", "));
      setCities((bb.cities ?? []).join(", "));
      setMinPrice(bb.minPrice ? String(bb.minPrice) : "");
      setMaxPrice(bb.maxPrice ? String(bb.maxPrice) : "");
      setTypes(bb.propertyTypes ?? []);
      setMinBeds(bb.minBeds ? String(bb.minBeds) : "");
      setKeywords(bb.keywords ?? "");
      setAlertOn(!!bb.alertOn);
    }
  }, [bb]);

  const save = trpc.notifications.upsertBuyBox.useMutation({
    onSuccess: () => {
      toast.success("Buy box saved");
      utils.notifications.buyBox.invalidate();
      utils.notifications.buyBoxMatches.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const split = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <h3 className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-primary" /> My buy box
          </h3>
          <p className="text-xs text-muted-foreground">
            Describe what you buy — matching listings (including new ones) get
            pushed to you.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">States (comma-sep)</Label>
              <Input
                placeholder="TX, AZ, FL"
                value={states}
                onChange={(e) => setStates(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cities</Label>
              <Input
                placeholder="Austin, Tampa"
                value={cities}
                onChange={(e) => setCities(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Min price</Label>
              <Input
                type="number"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max price</Label>
              <Input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Property types</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {PROPERTY_TYPES.map((t) => (
                <label
                  key={t.value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={types.includes(t.value)}
                    onCheckedChange={(c) =>
                      setTypes((p) =>
                        c ? [...p, t.value] : p.filter((x) => x !== t.value),
                      )
                    }
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Min beds</Label>
              <Input
                type="number"
                value={minBeds}
                onChange={(e) => setMinBeds(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Keywords (comma-sep)</Label>
              <Input
                placeholder="pool, fixer, value-add"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm">
              <Bell className="h-4 w-4 text-primary" /> Alert me on new matches
            </span>
            <Switch checked={alertOn} onCheckedChange={setAlertOn} />
          </label>
          <Button
            className="w-full"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                name,
                states: split(states),
                cities: split(cities),
                minPrice: minPrice ? Number(minPrice) : undefined,
                maxPrice: maxPrice ? Number(maxPrice) : undefined,
                propertyTypes: types as any,
                minBeds: minBeds ? Number(minBeds) : undefined,
                keywords: keywords || undefined,
                alertOn: alertOn ? 1 : 0,
              })
            }
          >
            Save buy box
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 font-semibold">
          Matches right now ({matches?.items.length ?? 0})
        </h3>
        {!bb && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-10 text-center text-muted-foreground">
              Save your buy box to see matching listings.
            </CardContent>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {matches?.items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      </div>
    </div>
  );
}
