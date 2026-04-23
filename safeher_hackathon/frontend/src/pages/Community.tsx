import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Users, ShieldCheck, Heart, Share2, PlusCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Community() {
  const [, setLocation] = useLocation();
  const [isPosting, setIsPosting] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [alias, setAlias] = useState("Anonymous Sister");

  const postsQuery = trpc.community.list.useQuery();
  const createPostMutation = trpc.community.createPost.useMutation({
    onSuccess: () => {
      postsQuery.refetch();
      setIsPosting(false);
      setContent("");
      toast.success("Shared successfully. Your message is live!");
    }
  });

  const categories = [
    { id: "general", label: "General Advice", icon: MessageSquare },
    { id: "travel", label: "Safe Travel", icon: Share2 },
    { id: "warning", label: "Area Alerts", icon: ShieldCheck },
    { id: "support", label: "Emotional Support", icon: Heart },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createPostMutation.mutate({ authorAlias: alias, category, content });
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
               toast.info("Connecting to nearby Guardian Network...");
               setLocation("/map");
             }}
           >
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-rose-200 transition-colors">
                 <ShieldCheck className="w-5 h-5 text-rose-700" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-rose-900 transition-colors">Nearby Guardians</h3>
              <p className="text-xs text-gray-600 leading-relaxed">Total verified volunteers: 482 active in your city. Click to view on map.</p>
           </button>
        </div>

        {/* Feed */}
        <div className="md:col-span-3 space-y-6">
          
          {/* Post Form */}
          <Card className="bg-white border-rose-100 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-gray-900 text-lg flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-rose-700" />
                Share something
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-4">
                   <Input 
                     placeholder="Your Safety Alias (e.g. BraveSister7)" 
                     className="bg-white border-rose-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-rose-200"
                     value={alias}
                     onChange={(e) => setAlias(e.target.value)}
                   />
                </div>
                <Textarea 
                  placeholder="Share a safety tip or ask for advice (Anonymously)..."
                  className="bg-white border-rose-200 text-gray-900 min-h-[120px] placeholder:text-gray-400 focus-visible:ring-rose-200"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                <Button className="w-full bg-rose-950 hover:bg-rose-900 text-white font-bold h-12 rounded-xl" disabled={createPostMutation.isPending}>
                  Post Anonymously
                </Button>
              </form>
            </CardContent>
          </Card>

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
  </div>
  );
}
