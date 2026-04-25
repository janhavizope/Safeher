import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Users, ShieldCheck, Heart, Share2, Send, Lock, Paperclip, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getOrCreateDeviceId } from "@/lib/device";

type ChatMedia = {
  key: string;
  url: string;
  mimeType: string;
  fileSize: number;
};

type SelectedMediaFile = {
  file: File;
  previewUrl: string;
};

function makeAnonymousAlias(): string {
  return `Anonymous Sister ${Math.floor(1000 + Math.random() * 9000)}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export default function Community() {
  const [, setLocation] = useLocation();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [alias, setAlias] = useState(makeAnonymousAlias);
  const [selectedFiles, setSelectedFiles] = useState<SelectedMediaFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isVerifiedUser = Boolean(getOrCreateDeviceId());

  const postsQuery = trpc.community.list.useQuery();
  const uploadMediaMutation = trpc.incidents.uploadMedia.useMutation();
  const createPostMutation = trpc.community.createPost.useMutation({
    onSuccess: () => {
      postsQuery.refetch();
      setContent("");
      setAlias(makeAnonymousAlias());
      setSelectedFiles([]);
      toast.success("Shared successfully. Your message is live!");
    },
    onError: (error) => {
      toast.error(error.message || "Only verified users can post in Sisterhood Hub.");
    }
  });

  const categories = [
    { id: "general", label: "General Advice", icon: MessageSquare },
    { id: "travel", label: "Safe Travel", icon: Share2 },
    { id: "warning", label: "Area Alerts", icon: ShieldCheck },
    { id: "support", label: "Emotional Support", icon: Heart },
  ];

  const isBusy = createPostMutation.isPending || uploadMediaMutation.isPending;

  const onPickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const accepted = files.filter(file => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (accepted.length !== files.length) {
      toast.error("Only images and videos are allowed.");
    }

    const next = [...selectedFiles];
    for (const file of accepted) {
      if (next.length >= 4) break;
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 10MB.`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setSelectedFiles(next);
    event.target.value = "";
  };

  const removeSelectedFile = (index: number) => {
    const toRemove = selectedFiles[index];
    if (toRemove) {
      URL.revokeObjectURL(toRemove.previewUrl);
    }
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!isVerifiedUser) {
      toast.error("Device verification failed. Please refresh and try again.");
      return;
    }
    if (!content.trim() && selectedFiles.length === 0) return;

    try {
      let media: ChatMedia[] = [];
      if (selectedFiles.length > 0) {
        media = await Promise.all(
          selectedFiles.map(async item => {
            const contentBase64 = await fileToBase64(item.file);
            return uploadMediaMutation.mutateAsync({
              fileName: item.file.name,
              mimeType: item.file.type || "application/octet-stream",
              fileSize: item.file.size,
              contentBase64,
            });
          })
        );
      }

      createPostMutation.mutate({
        authorAlias: alias,
        category,
        content: content.trim() || "Shared media",
        media,
      });
    } catch (error) {
      toast.error("Failed to upload media. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-stone-50 to-white flex flex-col">
      <nav className="border-b border-rose-100 bg-white/80 backdrop-blur px-4 py-4 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/")} className="text-rose-950 hover:text-rose-900 hover:bg-rose-50">
          ← Back
        </Button>
        <h1 className="text-xl font-bold text-rose-950 flex items-center gap-2">
          <Users className="w-5 h-5 text-rose-700" />
          Sisterhood Hub
        </h1>
        <div className="w-16"></div>
      </nav>

      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-4xl mx-auto mb-10 text-center animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-4xl font-serif font-bold text-rose-950 mb-2">Anonymous Sisterhood</h2>
          <p className="text-gray-600">A safe space for women to share experiences and safety advice anonymously.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900">
            {isVerifiedUser ? "Verified device connected: chat enabled" : "Unverified device: chat blocked"}
          </div>
        </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Categories Sidebar */}
        <div className="md:col-span-1 space-y-4">
           {categories.map((cat) => (
             <button 
               key={cat.id}
               onClick={() => setCategory(cat.id)}
               className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                 category === cat.id ? "bg-rose-900 border-rose-950 text-white shadow-md shadow-rose-900/10" : "bg-white border-rose-200 text-gray-700 hover:bg-rose-50 hover:border-rose-300"
               }`}
             >
               <cat.icon className="w-5 h-5" />
               <span className="text-sm font-medium">{cat.label}</span>
             </button>
           ))}
           <button 
             className="w-full text-left p-5 bg-gradient-to-br from-rose-50 to-white border border-rose-200 rounded-2xl mt-8 shadow-sm hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group"
             onClick={() => {
               toast.info("Connecting to nearby Safety Network...");
               setLocation("/map");
             }}
           >
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-rose-200 transition-colors">
                 <ShieldCheck className="w-5 h-5 text-rose-700" />
              </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-rose-900 transition-colors">Nearby Support Circle</h3>
              <p className="text-xs text-gray-600 leading-relaxed">Total verified volunteers: 482 active in your city. Click to view on map.</p>
           </button>
        </div>

        {/* Feed */}
        <div className="md:col-span-3 space-y-6 pb-40">
          {/* Posts List */}
          <div className="space-y-4">
            {postsQuery.isLoading ? (
              <div className="animate-pulse space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-32 bg-rose-50 rounded-xl border border-rose-100"></div>)}
              </div>
            ) : postsQuery.data?.posts.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-rose-200 rounded-2xl bg-white">
                 <MessageSquare className="w-12 h-12 text-rose-300 mx-auto mb-4" />
                 <p className="text-gray-500">No conversations here yet. Be the first to speak!</p>
              </div>
            ) : (
              postsQuery.data?.posts.map((post) => (
                <Card key={post.id} className="bg-white border-rose-100 hover:border-rose-300 transition-all shadow-sm">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                       <span className="text-gray-900 font-bold">{post.authorAlias}</span>
                       <span className="text-rose-900 text-[10px] uppercase font-bold tracking-wider bg-rose-100 px-2 py-1 rounded-full border border-rose-200">
                         {categories.find(c => c.id === post.category)?.label || post.category}
                       </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 leading-relaxed text-sm md:text-base">{post.content}</p>
                    {Array.isArray((post as any).mediaUrls) && (post as any).mediaUrls.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(post as any).mediaUrls.map((media: ChatMedia, index: number) => (
                          <div key={`${post.id}-${index}`} className="overflow-hidden rounded-xl border border-rose-100">
                            {media.mimeType.startsWith("image/") ? (
                              <img src={media.url} alt="Shared by anonymous member" className="h-44 w-full object-cover" />
                            ) : (
                              <video src={media.url} controls className="h-44 w-full object-cover" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-4 mt-6 pt-4 border-t border-rose-50">
                       <button className="flex items-center gap-2 text-xs font-medium text-rose-600 hover:text-rose-500 transition-colors">
                          <Heart className="w-4 h-4" /> Support Sister
                       </button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

      </div>
    </div>

    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-rose-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-900">
            {alias}
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-900">
            {categories.find(c => c.id === category)?.label}
          </span>
          {!isVerifiedUser && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
              <Lock className="h-3 w-3" />
              Unverified devices are blocked from chat
            </span>
          )}
        </div>

        {selectedFiles.length > 0 && (
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {selectedFiles.map((item, index) => (
              <div key={`${item.file.name}-${index}`} className="relative overflow-hidden rounded-xl border border-rose-200 bg-rose-50">
                {item.file.type.startsWith("image/") ? (
                  <img src={item.previewUrl} alt={item.file.name} className="h-20 w-full object-cover" />
                ) : (
                  <video src={item.previewUrl} className="h-20 w-full object-cover" />
                )}
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-900"
                  onClick={() => removeSelectedFile(index)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[210px_1fr_auto]">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-rose-200"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isVerifiedUser || isBusy}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Attach
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 border-rose-200"
              onClick={() => setAlias(makeAnonymousAlias())}
              disabled={!isVerifiedUser || isBusy}
            >
              New Name
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={onPickFiles}
            />
          </div>
          <Input
            placeholder={isVerifiedUser ? "Type a message..." : "Verify your account to chat"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className="h-11 rounded-full border-rose-200 bg-white px-4"
            disabled={!isVerifiedUser || isBusy}
          />
          <Button
            className="h-11 rounded-full bg-rose-950 px-5 text-white hover:bg-rose-900"
            onClick={() => void handleSubmit()}
            disabled={!isVerifiedUser || (!content.trim() && selectedFiles.length === 0) || isBusy}
          >
            <Send className="mr-2 h-4 w-4" />
            {isBusy ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  </div>
  );
}
