import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, MapPin, Loader2, CheckCircle, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { MapView } from "@/components/Map";

type UploadedMedia = {
  key: string;
  url: string;
  mimeType: string;
  fileSize: number;
  fileName: string;
};

const MAX_FILES = 3;
const MIN_DESCRIPTION_CHARS = 10;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("Invalid file content"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export default function Report() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"form" | "map" | "review" | "success">("form");
  const [formData, setFormData] = useState({
    description: "",
    incidentType: "",
    severity: "",
    reportedAt: new Date().toISOString().split("T")[0],
    reportedTime: new Date().toTimeString().slice(0, 5),
    reporterAlias: "",
  });
  const [location, setReportLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [llmSuggestion, setLlmSuggestion] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentId, setIncidentId] = useState<number | null>(null);
  const [trackingPin, setTrackingPin] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const mapRef = useRef<any | null>(null);
  const locationMarkerRef = useRef<any>(null);

  const submitMutation = trpc.incidents.submit.useMutation();
  const uploadMutation = trpc.incidents.uploadMedia.useMutation();

  const generateAlias = () => {
    const adjs = ["Golden", "Neon", "Shadow", "Silent", "Midnight", "Brave", "Swift", "Bright", "Emerald", "Solar"];
    const nouns = ["Sentinel", "Guardian", "Scout", "Shield", "Watcher", "Protector", "Falcon", "Eagle", "Fox", "Oak"];
    const adj = adjs[Math.floor(Math.random() * adjs.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 99) + 1;
    setFormData(prev => ({ ...prev, reporterAlias: `${adj} ${noun} ${num}` }));
  };

  // Get LLM classification when description changes
  useEffect(() => {
    if (formData.description.length > 50) {
      // Simulate LLM call - in real implementation, this would be a server-side call
      // For now, we'll just show the form as-is
    }
  }, [formData.description]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const setIncidentLocation = (lat: number, lng: number, title: string) => {
    setReportLocation({ lat, lng });

    if (!mapRef.current || !window.L) {
      return;
    }

    if (locationMarkerRef.current) {
      mapRef.current.removeLayer(locationMarkerRef.current);
    }

    locationMarkerRef.current = window.L.marker([lat, lng], {
      title,
    }).addTo(mapRef.current);
  };

  const requestCurrentLocation = (showToast: boolean) => {
    if (!navigator.geolocation) {
      if (showToast) {
        toast.error("Geolocation is not supported in this browser. Tap map to select location.");
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setIncidentLocation(lat, lng, "Current Location");

        if (mapRef.current) {
          mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom() || 12, 14));
        }

        if (showToast) {
          toast.success("Current location selected.");
        }
      },
      () => {
        if (showToast) {
          toast.error("Could not detect your location. Tap on map to select it manually.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60_000,
      }
    );
  };

  const getSubmitErrorMessage = (error: any): string => {
    const defaultMessage = "Failed to submit incident";
    const rawMessage = typeof error?.message === "string" ? error.message.trim() : "";

    if (rawMessage.startsWith("[") && rawMessage.endsWith("]")) {
      try {
        const parsed = JSON.parse(rawMessage) as Array<{ message?: string; path?: Array<string | number> }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          const first = parsed[0];
          if (first?.path?.includes("description")) {
            return `Description must be at least ${MIN_DESCRIPTION_CHARS} characters.`;
          }
          if (first?.message) {
            return first.message;
          }
        }
      } catch {
        // Fall through to generic handling.
      }
    }

    return rawMessage || defaultMessage;
  };

  const handleMapReady = (map: any) => {
    mapRef.current = map;
    requestCurrentLocation(false);

    // Add click listener to map
    map.on("click", (event: any) => {
      const lat = event?.latlng?.lat;
      const lng = event?.latlng?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return;
      }
      setIncidentLocation(lat, lng, "Incident Location");
      toast.success("Location selected! Click Next to continue.");
    });
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files ?? []);
    if (incoming.length === 0) return;

    const availableSlots = Math.max(0, MAX_FILES - uploadedMedia.length);
    if (availableSlots === 0) {
      toast.error("You can upload up to 3 files only");
      event.target.value = "";
      return;
    }

    const files = incoming.slice(0, availableSlots);
    if (incoming.length > availableSlots) {
      toast.error(`Only ${availableSlots} more file(s) can be uploaded`);
    }

    setUploadingCount(files.length);
    try {
      for (const file of files) {
        const contentBase64 = await fileToBase64(file);
        const uploaded = await uploadMutation.mutateAsync({
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          contentBase64,
        });
        setUploadedMedia(prev => [
          ...prev,
          {
            ...uploaded,
            fileName: file.name,
          },
        ]);
      }
      toast.success("Media uploaded successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload one or more files");
    } finally {
      setUploadingCount(0);
      event.target.value = "";
    }
  };

  const removeUploadedMedia = (key: string) => {
    setUploadedMedia(prev => prev.filter(item => item.key !== key));
  };

  const handleSubmit = async () => {
    const descriptionText = formData.description.trim();

    // Validate form
    if (!descriptionText) {
      toast.error("Please describe the incident");
      return;
    }
    if (descriptionText.length < MIN_DESCRIPTION_CHARS) {
      toast.error(`Description must be at least ${MIN_DESCRIPTION_CHARS} characters.`);
      return;
    }
    if (!formData.incidentType) {
      toast.error("Please select an incident type");
      return;
    }
    if (!formData.severity) {
      toast.error("Please select a severity level");
      return;
    }
    if (!location) {
      toast.error("Please select a location on the map");
      return;
    }

    setIsSubmitting(true);

    try {
      const reportedDateTime = new Date(`${formData.reportedAt}T${formData.reportedTime}`);

      const result = await submitMutation.mutateAsync({
        latitude: location.lat,
        longitude: location.lng,
        description: descriptionText,
        incidentType: formData.incidentType as any,
        severity: formData.severity as any,
        reportedAt: reportedDateTime,
        mediaUrls: uploadedMedia.map(item => item.url),
        media: uploadedMedia.map(item => ({
          key: item.key,
          url: item.url,
          mimeType: item.mimeType,
          fileSize: item.fileSize,
        })),
        reporterAlias: formData.reporterAlias,
      });

      setIncidentId(result.incidentId);
      setTrackingPin(result.trackingPin || null);
      setStep("success");
      toast.success("Incident reported successfully!");
    } catch (error: any) {
      toast.error(getSubmitErrorMessage(error));
      console.error("Submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="text-rose-950 hover:text-rose-900 hover:bg-rose-50 mb-4">
            ← Back to Home
          </Button>
          <h1 className="text-4xl font-serif font-bold text-rose-950 mb-2">Report an Incident</h1>
          <p className="text-gray-600">Your report is completely anonymous. No personal information will be stored.</p>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-4 mb-8">
          {["form", "map", "review", "success"].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full transition-colors ${
                ["form", "map", "review", "success"].indexOf(step) >= i ? "bg-rose-950" : "bg-rose-200"
              }`}
            />
          ))}
        </div>

        {/* Form Step */}
        {step === "form" && (
          <Card className="bg-white border-rose-100 shadow-sm mb-6 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-rose-950">Describe the Incident</CardTitle>
              <CardDescription className="text-gray-500">Provide as much detail as you're comfortable sharing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="description" className="text-gray-700 mb-2 block font-medium">
                  Incident Description *
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Describe what happened, where, and any relevant details..."
                  value={formData.description}
                  onChange={handleInputChange}
                  className="bg-white border-rose-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-rose-200 min-h-32"
                />
                <p className="text-gray-500 text-sm mt-2">{formData.description.length}/5000 characters</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="incidentType" className="text-gray-700 mb-2 block font-medium">
                    Incident Type *
                  </Label>
                  <Select value={formData.incidentType} onValueChange={(v) => handleSelectChange("incidentType", v)}>
                    <SelectTrigger className="bg-white border-rose-200 text-gray-900">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-rose-100 text-gray-900">
                      <SelectItem value="harassment">Harassment</SelectItem>
                      <SelectItem value="assault">Assault</SelectItem>
                      <SelectItem value="stalking">Stalking</SelectItem>
                      <SelectItem value="theft">Theft</SelectItem>
                      <SelectItem value="unsafe_area">Unsafe Area</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="severity" className="text-gray-700 mb-2 block font-medium">
                    Severity Level *
                  </Label>
                  <Select value={formData.severity} onValueChange={(v) => handleSelectChange("severity", v)}>
                    <SelectTrigger className="bg-white border-rose-200 text-gray-900">
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-rose-100 text-gray-900">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="media" className="text-gray-700 mb-2 block font-medium">
                  Attach Media (optional, up to 3 files)
                </Label>
                <input
                  id="media"
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  multiple
                  onChange={handleFilesSelected}
                  className="h-10 w-full rounded-md border border-rose-200 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-rose-950 file:px-3 file:py-1.5 file:text-white"
                  disabled={uploadMutation.isPending || uploadedMedia.length >= MAX_FILES}
                />
                <p className="text-gray-500 text-xs mt-2">
                  Max size 10MB each. Allowed: images, mp4, webm, mov, avi.
                </p>
                {uploadingCount > 0 ? (
                  <p className="text-rose-600 text-sm mt-2">Uploading {uploadingCount} file(s)...</p>
                ) : null}
                {uploadedMedia.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {uploadedMedia.map(item => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between text-sm bg-rose-50 border border-rose-100 rounded px-3 py-2"
                      >
                        <span className="text-gray-900 truncate pr-4">{item.fileName}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-100"
                          onClick={() => removeUploadedMedia(item.key)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reportedAt" className="text-gray-700 mb-2 block font-medium">
                    Date of Incident *
                  </Label>
                  <Input
                    id="reportedAt"
                    name="reportedAt"
                    type="date"
                    value={formData.reportedAt}
                    onChange={handleInputChange}
                    className="bg-white border-rose-200 text-gray-900 [color-scheme:light]"
                  />
                </div>

                <div>
                  <Label htmlFor="reportedTime" className="text-gray-700 mb-2 block font-medium">
                    Time of Incident *
                  </Label>
                  <Input
                    id="reportedTime"
                    name="reportedTime"
                    type="time"
                    value={formData.reportedTime}
                    onChange={handleInputChange}
                    className="bg-white border-rose-200 text-gray-900 [color-scheme:light]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-rose-100">
                <Label htmlFor="reporterAlias" className="text-gray-700 mb-2 block font-bold flex items-center justify-between">
                  <span>Anonymous Identity (Alias)</span>
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-widest bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">SafeHer Privacy</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="reporterAlias"
                    name="reporterAlias"
                    placeholder="e.g. Shadow Runner 42"
                    value={formData.reporterAlias}
                    onChange={handleInputChange}
                    className="bg-white border-rose-200 text-gray-900 placeholder:text-gray-400 flex-1 h-12"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generateAlias}
                    className="border-rose-200 text-rose-950 bg-white hover:bg-rose-50 h-12"
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-gray-500 text-[10px] mt-2 italic capitalize">pick a dummy name. only this pseudonym will be seen by others.</p>
              </div>

              <Button
                onClick={() => setStep("map")}
                disabled={!formData.description || !formData.incidentType || !formData.severity}
                className="w-full bg-rose-950 hover:bg-rose-900 text-white font-bold h-12 rounded-xl"
              >
                Next: Select Location
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Map Step */}
        {step === "map" && (
          <Card className="bg-white border-rose-100 shadow-sm mb-6 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-rose-950 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-700" />
                Select Incident Location
              </CardTitle>
              <CardDescription className="text-gray-500">Your current location is auto-selected. Tap the map only if you want to adjust the pin.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 h-96 rounded-lg overflow-hidden border border-rose-100 bg-gray-50">
                <MapView onMapReady={handleMapReady} />
              </div>

              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-3 flex items-center justify-between gap-3">
                <p className="text-sm text-rose-900 font-medium">
                  {location ? `Selected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Location not selected yet"}
                </p>
                <Button type="button" variant="outline" className="border-rose-200 text-rose-950 hover:bg-rose-100" onClick={() => requestCurrentLocation(true)}>
                  Use My Current Location
                </Button>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1 border-rose-200 text-gray-700 hover:bg-rose-50 h-12 rounded-xl">
                  Back
                </Button>
                <Button disabled={!location} onClick={() => setStep("review")} className="flex-1 bg-rose-950 hover:bg-rose-900 text-white font-bold h-12 rounded-xl">
                  Next: Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review Step */}
        {step === "review" && (
          <Card className="bg-white border-rose-100 shadow-sm mb-6 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-rose-950">Review Your Report</CardTitle>
              <CardDescription className="text-gray-500">Please verify all information before submitting</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-sm">Incident Type</p>
                  <p className="text-gray-900 font-semibold capitalize">{formData.incidentType}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Severity</p>
                  <p className="text-gray-900 font-semibold capitalize">{formData.severity}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Date & Time</p>
                  <p className="text-gray-900 font-semibold">
                    {formData.reportedAt} at {formData.reportedTime}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Location</p>
                  <p className="text-gray-900 font-semibold">
                    {location?.lat.toFixed(4)}, {location?.lng.toFixed(4)}
                  </p>
                </div>
              </div>

              {uploadedMedia.length > 0 ? (
                <div>
                  <p className="text-gray-500 text-sm mb-2">Attached Media</p>
                  <p className="text-gray-900 font-semibold">{uploadedMedia.length} file(s) attached</p>
                </div>
              ) : null}

              <div>
                <p className="text-gray-500 text-sm mb-2">Description</p>
                <p className="text-gray-900 bg-rose-50 border border-rose-100 p-4 rounded-xl leading-relaxed">{formData.description}</p>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-rose-700 text-sm flex items-center gap-2 font-medium">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  Your report will be completely anonymous. No personal information will be stored.
                </p>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep("map")} className="flex-1 border-rose-200 text-gray-700 hover:bg-rose-50 h-12 rounded-xl">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-rose-950 hover:bg-rose-900 text-white font-bold h-12 rounded-xl"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Report"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Step */}
        {step === "success" && (
          <Card className="bg-white border-rose-100 shadow-sm shadow-rose-100/50 mb-6 backdrop-blur-xl">
            <CardContent className="pt-12 pb-12 text-center">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-3xl font-serif font-bold text-rose-950 mb-4">Thank You!</h2>
              <p className="text-gray-600 mb-8 font-medium">
                Your incident has been submitted successfully to moderation review.
              </p>
              <p className="text-xs uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200 rounded-full px-4 py-1.5 inline-block mb-8 font-bold">
                Initial Status: Pending Review
              </p>

              <div className="bg-rose-50 p-6 rounded-2xl mb-8 inline-block shadow-inner border border-rose-100 w-full max-w-sm">
                <p className="text-rose-700/60 font-bold mb-3 text-sm uppercase tracking-widest">Your Private Tracking PIN</p>
                <div className="text-5xl font-mono font-bold tracking-widest text-emerald-600 bg-white px-6 py-4 rounded-xl shadow-md border border-emerald-100 inline-block drop-shadow-sm">{trackingPin}</div>
                <p className="text-xs text-rose-700 font-bold mt-5 uppercase tracking-widest bg-white py-1.5 px-4 rounded-full inline-block text-center mx-auto border border-rose-100 shadow-sm">
                   Please save this PIN securely
                </p>
                <p className="text-gray-500 text-[11px] mt-4 max-w-xs mx-auto leading-relaxed">This PIN is the only way to anonymously track the verification status of your report. You will not be emailed.</p>
              </div>

              <div className="flex gap-4 max-w-sm mx-auto">
                <Button variant="outline" onClick={() => setLocation("/")} className="flex-1 border-rose-200 text-gray-700 hover:bg-rose-50 h-12 rounded-xl">
                  Back to Home
                </Button>
                <Button onClick={() => setLocation("/track")} className="flex-1 bg-rose-950 hover:bg-rose-900 text-white font-bold h-12 rounded-xl">
                  Track Status Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
