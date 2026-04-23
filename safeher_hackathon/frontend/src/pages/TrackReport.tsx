import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ShieldCheck, AlertCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function TrackReport() {
  const [, setLocation] = useLocation();
  const [pin, setPin] = useState("");
  const [searchedPin, setSearchedPin] = useState("");
  const previousStatusRef = useRef<string | null>(null);

  const trackQuery = trpc.incidents.trackStatus.useQuery(
    { pin: searchedPin },
    {
      enabled: searchedPin.length >= 6,
      retry: false,
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.status;
        return status === "pending" ? 3000 : false;
      },
    }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length >= 6) {
      setSearchedPin(pin.toUpperCase());
      previousStatusRef.current = null;
    }
  };

  useEffect(() => {
    const currentStatus = trackQuery.data?.status;
    if (!currentStatus) return;

    const previousStatus = previousStatusRef.current;
    const becameVerified = previousStatus === "pending" && currentStatus === "verified";

    if (becameVerified) {
      alert("Your report has been verified by moderators.");

      if (typeof window !== "undefined" && "Notification" in window) {
        const body = "Your report has been verified and is now visible in the community feed.";
        if (Notification.permission === "granted") {
          new Notification("SafeHer Update", { body });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              new Notification("SafeHer Update", { body });
            }
          });
        }
      }
    }

    previousStatusRef.current = currentStatus;
  }, [trackQuery.data?.status]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />;
      case "resolved":
        return <ShieldCheck className="w-12 h-12 text-blue-500 mb-4" />;
      case "dismissed":
        return <XCircle className="w-12 h-12 text-red-500 mb-4" />;
      default:
        return <Clock className="w-12 h-12 text-yellow-500 mb-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "verified":
        return "Verified & Published";
      case "resolved":
        return "Resolved by Admins";
      case "dismissed":
        return "Dismissed";
      default:
        return "Pending Review";
    }
  };

  const statusSteps = ["pending", "verified", "resolved"] as const;

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col">
      <nav className="bg-white/80 border-b border-rose-100 backdrop-blur p-4">
        <div className="container mx-auto">
          <Button variant="ghost" onClick={() => setLocation("/")} className="text-rose-950 hover:text-rose-900 hover:bg-rose-50">
            ← Back to Home
          </Button>
        </div>
      </nav>

      <div className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif font-bold text-rose-950 mb-4">Track Your Report</h1>
            <p className="text-gray-600">
              Enter the secure Tracking PIN you received when submitting your anonymous report.
            </p>
          </div>

          <Card className="shadow-sm border-rose-100 bg-white/95 backdrop-blur-xl">
            <CardHeader>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter 6-digit PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="uppercase tracking-widest text-center text-lg bg-white border-rose-200 text-gray-900 placeholder:text-gray-400 h-14"
                  maxLength={10}
                />
                <Button type="submit" disabled={pin.length < 6} className="bg-rose-950 hover:bg-rose-900 text-white h-14 w-14 rounded-xl">
                  <Search className="w-6 h-6" />
                </Button>
              </form>
            </CardHeader>
            <CardContent>
              {trackQuery.isLoading && searchedPin && (
                <div className="text-center py-8 text-gray-500">Retrieving secure data...</div>
              )}
              
              {trackQuery.isError && (
                <div className="text-center py-8 flex flex-col items-center">
                  <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
                  <p className="text-rose-950 font-bold">Report Not Found</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Please ensure you typed the PIN correctly. It is case-insensitive.
                  </p>
                </div>
              )}

              {trackQuery.isSuccess && trackQuery.data && (
                <div className="text-center py-8 flex flex-col items-center border-t border-rose-100 animate-in fade-in zoom-in duration-300">
                  {getStatusIcon(trackQuery.data.status)}
                  <h3 className="text-2xl font-bold text-rose-950 mb-2">
                    {getStatusText(trackQuery.data.status)}
                  </h3>

                  <div className="w-full bg-rose-50 border border-rose-100 rounded-xl px-3 py-3 mb-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Status Progress</p>
                    <div className="grid grid-cols-3 gap-2">
                      {statusSteps.map((step, index) => {
                        const current = trackQuery.data.status;
                        const currentIndex = statusSteps.indexOf((current === "dismissed" ? "verified" : current) as any);
                        const isActive = step === current || (current === "dismissed" && step === "verified");
                        const isPassed = current !== "dismissed" && currentIndex >= index;
                        return (
                          <div
                            key={step}
                            className={`rounded-xl px-2 py-2 text-[10px] uppercase tracking-wider font-bold text-center border ${
                              isActive
                                ? "bg-rose-950 text-white border-rose-900"
                                : isPassed
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : "bg-white text-gray-400 border-gray-200"
                            }`}
                          >
                            {step}
                          </div>
                        );
                      })}
                    </div>
                    {trackQuery.data.status === "dismissed" && (
                      <p className="mt-4 text-[10px] uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 rounded px-2 py-1 inline-block">
                        This report was dismissed by moderators
                      </p>
                    )}
                  </div>

                  {trackQuery.data.status === "pending" && (
                    <p className="text-xs uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 rounded-full px-4 py-1.5 mb-3 font-bold">
                      Auto-refreshing every 3s until verification
                    </p>
                  )}
                  <div className="w-full bg-white rounded-xl p-5 mt-6 text-left space-y-4 border border-rose-100 shadow-sm">
                    <div className="flex justify-between border-b border-rose-50 pb-3">
                      <span className="text-gray-500 text-sm">Incident Type</span>
                      <span className="font-bold capitalize text-gray-900">
                        {trackQuery.data.incidentType.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-rose-50 pb-3">
                      <span className="text-gray-500 text-sm">Severity</span>
                      <span className="font-bold capitalize text-gray-900">{trackQuery.data.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-sm">Submitted on</span>
                      <span className="font-bold text-gray-900">
                        {new Date(trackQuery.data.submittedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {trackQuery.data.latestNote && (
                      <div className="mt-5 pt-5 border-t border-rose-100">
                        <span className="text-gray-500 text-sm block mb-2 uppercase tracking-widest text-[10px]">Latest Moderator Note</span>
                        <p className="text-emerald-800 text-sm bg-emerald-50 p-4 rounded-xl border border-emerald-200 leading-relaxed shadow-sm">
                          {trackQuery.data.latestNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {Array.isArray(trackQuery.data.statusTimeline) && trackQuery.data.statusTimeline.length > 0 && (
                    <div className="w-full mt-6 text-left">
                      <p className="text-xs uppercase tracking-widest text-gray-500 mb-3 ml-1 font-bold">Moderator History</p>
                      <div className="space-y-3">
                        {trackQuery.data.statusTimeline
                          .slice()
                          .reverse()
                          .map((entry: any, index: number) => (
                            <div key={`${entry.at}-${index}`} className="bg-white border border-rose-100 shadow-sm rounded-xl px-4 py-3">
                              <p className="text-xs text-gray-900 font-bold capitalize">
                                {entry.status} by {entry.actor || "Moderator"}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">
                                {new Date(entry.at).toLocaleString()}
                              </p>
                              {entry.note ? (
                                <p className="text-sm text-emerald-700 mt-2 bg-emerald-50 p-2 rounded border border-emerald-200 italic">{entry.note}</p>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
