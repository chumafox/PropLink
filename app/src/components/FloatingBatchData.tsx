import { useState, useRef, useEffect } from "react";
import { X, DollarSign, Activity, Calculator, User, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { trpc } from "../providers/trpc";
import { toast } from "sonner";

export const FloatingBatchData = ({
  isOpen,
  onClose,
  listingId,
}: {
  isOpen: boolean;
  onClose: () => void;
  listingId: number;
}) => {
  const [pos, setPos] = useState({ x: window.innerWidth > 800 ? window.innerWidth - 450 : 20, y: 120 });
  const [size] = useState({ w: 320, h: 420 });
  const [isFetching, setIsFetching] = useState(false);
  
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const utils = trpc.useUtils();
  const { data: listingData, isLoading } = trpc.listings.byId.useQuery(
    { id: listingId },
    { enabled: isOpen && !!listingId }
  );
  const listing = listingData?.listing;

  const saveBatchData = trpc.listings.updateBatchData.useMutation({
    onSuccess: () => {
      utils.listings.byId.invalidate({ id: listingId });
      toast.success("Financial data saved successfully!");
    },
    onError: (err) => {
      toast.error("Failed to save financial data: " + err.message);
    }
  });


  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragging.current) {
        setPos({
          x: e.clientX - dragStart.current.x,
          y: e.clientY - dragStart.current.y,
        });
      }
    };
    const onUp = () => {
      dragging.current = false;
    };
    if (isOpen) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFetch = async () => {
    if (!listing) return;
    setIsFetching(true);
    try {
      const address = `${listing.addressLine1}, ${listing.city}, ${listing.state} ${listing.zip}`;
      
      // In the future, replace with real Firebase token
      const token = "DUMMY_TOKEN"; 
      
      const res = await fetch("https://vac-scraper-api.onrender.com/api/property", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ address })
      });

      if (!res.ok) {
        toast.error(`BatchData API error (${res.status}). Please check API configuration.`);
        return;
      }
      const json = await res.json();
      const data = json?.data?.[0];

      if (data) {
        saveBatchData.mutate({
          id: listingId,
          batchData: {
            estimatedEquity: data.valuation?.estimatedEquity,
            taxAmount: data.tax?.taxAmount,
            mortgageBalance: data.openLien?.totalOpenLienBalance,
            arv: data.intel?.arv,
            ownerName: data.owner?.fullName || data.owner?.names?.[0]?.full,
            hash: data.address?.hash
          }
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error("Failed to fetch data: " + err.message);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const batchData = listing?.batchData as any;

  return (
    <div
      className="fixed z-50 bg-background border rounded-lg shadow-xl overflow-hidden flex flex-col"
      style={{
        left: Math.max(0, pos.x),
        top: Math.max(0, pos.y),
        width: size.w,
        height: size.h,
      }}
    >
      <div
        className="h-10 bg-muted/50 border-b flex items-center justify-between px-3 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          dragging.current = true;
          dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/batchdata.svg" alt="BatchData" className="h-4 w-auto grayscale" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Financials</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="text-sm font-medium mb-4">{listing?.addressLine1}</div>
            
            <div className="space-y-3">
              <DataRow icon={<DollarSign className="h-4 w-4 text-green-500" />} label="Est. Equity" value={batchData?.estimatedEquity ? `$${batchData.estimatedEquity.toLocaleString()}` : '—'} />
              <DataRow icon={<Activity className="h-4 w-4 text-blue-500" />} label="Property Tax" value={batchData?.taxAmount ? `$${batchData.taxAmount.toLocaleString()}` : '—'} />
              <DataRow icon={<Calculator className="h-4 w-4 text-red-500" />} label="Mortgage Balance" value={batchData?.mortgageBalance ? `$${batchData.mortgageBalance.toLocaleString()}` : '—'} />
              <DataRow icon={<DollarSign className="h-4 w-4 text-purple-500" />} label="After Repair Value" value={batchData?.arv ? `$${batchData.arv.toLocaleString()}` : '—'} />
              <DataRow icon={<User className="h-4 w-4 text-orange-500" />} label="Owner Name" value={batchData?.ownerName || '—'} />
            </div>

            <div className="pt-4 mt-auto">
              <Button 
                onClick={handleFetch} 
                disabled={isFetching || saveBatchData.isPending}
                className="w-full bg-[#24356C] hover:bg-[#3683BC] text-white"
              >
                {isFetching || saveBatchData.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {batchData ? "Refresh Data" : "Fetch Financial Data"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const DataRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-sm font-semibold">{value}</div>
  </div>
);
